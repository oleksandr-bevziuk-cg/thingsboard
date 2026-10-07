// SPDX-FileCopyrightText: Copyright The ThingsBoard Authors
// SPDX-License-Identifier: Apache-2.0
import { Component, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { PageComponent } from '@shared/components/page.component';
import { FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import {
  AdminSettings,
  DeviceConnectivityProtocol,
  DeviceConnectivitySettings,
  DeviceConnectivitySqsInfo,
  GeneralSettings,
  SqsQueueType,
  TestSqsConnectionRequest
} from '@shared/models/settings.models';
import { AdminService } from '@core/http/admin.service';
import { HasConfirmForm } from '@core/guards/confirm-on-exit.guard';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ActionNotificationShow } from '@core/notification/notification.actions';
import { TranslateService } from '@ngx-translate/core';
import { Authority } from '@shared/models/authority.enum';
import { getCurrentAuthUser } from '@core/auth/auth.selectors';

const sqsQueueUrlPattern = /^https:\/\/sqs\.[a-z0-9-]+\.amazonaws\.com\/\d{12}\/[a-zA-Z0-9_-]+(\.fifo)?$/;
const sqsFifoQueueNamePattern = /^[a-zA-Z0-9_-]+\.fifo$/;

@Component({
    selector: 'tb-general-settings',
    templateUrl: './general-settings.component.html',
    styleUrls: ['./general-settings.component.scss', './settings-card.scss'],
    standalone: false
})
export class GeneralSettingsComponent extends PageComponent implements HasConfirmForm, OnDestroy {

  generalSettings: FormGroup;
  deviceConnectivitySettingsForm: FormGroup;

  protocol: DeviceConnectivityProtocol = 'http';

  sqsQueueType = SqsQueueType;

  isTestingSqsConnection$ = new BehaviorSubject<boolean>(false);

  readonly isSysAdmin: boolean;

  private adminSettings: AdminSettings<GeneralSettings>;
  private deviceConnectivitySettings: AdminSettings<DeviceConnectivitySettings>;

  private readonly destroy$ = new Subject<void>();

  constructor(protected store: Store<AppState>,
              private adminService: AdminService,
              private translate: TranslateService,
              public fb: FormBuilder) {
    super(store);
    this.isSysAdmin = getCurrentAuthUser(store)?.authority === Authority.SYS_ADMIN;
    this.buildGeneralServerSettingsForm();
    this.adminService.getAdminSettings<GeneralSettings>('general')
      .subscribe(adminSettings => this.processGeneralSettings(adminSettings));
    this.buildDeviceConnectivitySettingsForm();
    this.adminService.getAdminSettings<DeviceConnectivitySettings>('connectivity')
      .subscribe(deviceConnectivitySettings => this.processDeviceConnectivitySettings(deviceConnectivitySettings));
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildGeneralServerSettingsForm() {
    this.generalSettings = this.fb.group({
      baseUrl: ['', [Validators.required]],
      prohibitDifferentUrl: ['',[]]
    });
  }

  private buildDeviceConnectivitySettingsForm() {
    this.deviceConnectivitySettingsForm = this.fb.group({
      http: this.buildDeviceConnectivityInfoForm(),
      https: this.buildDeviceConnectivityInfoForm(),
      mqtt: this.buildDeviceConnectivityInfoForm(),
      mqtts: this.buildDeviceConnectivityInfoForm(),
      coap: this.buildDeviceConnectivityInfoForm(),
      coaps: this.buildDeviceConnectivityInfoForm(),
      sqs: this.buildSqsConnectivityInfoForm()
    });
  }

  private buildSqsConnectivityInfoForm(): FormGroup {
    const formGroup = this.fb.group({
      enabled: [false, []],
      region: [{value: 'us-east-1', disabled: true}, [Validators.required]],
      accessKeyId: [{value: '', disabled: true}, [Validators.required]],
      secretAccessKey: [{value: '', disabled: true}],
      secretAccessKeySet: [false, []],
      sessionToken: [{value: '', disabled: true}],
      queueName: [{value: '', disabled: true}],
      queueUrl: [{value: '', disabled: true}, [Validators.pattern(sqsQueueUrlPattern)]],
      queueType: [{value: SqsQueueType.STANDARD, disabled: true}, [Validators.required]],
      messageGroupId: [{value: '', disabled: true}],
      useContentBasedDeduplication: [{value: false, disabled: true}],
      advanced: this.fb.group({
        endpointOverride: [{value: '', disabled: true}],
        visibilityTimeout: [{value: null, disabled: true}, [Validators.min(0), Validators.max(43200)]],
        pollingWaitTimeSeconds: [{value: null, disabled: true}, [Validators.min(0), Validators.max(20)]],
        maxMessagesPerPoll: [{value: null, disabled: true}, [Validators.min(1), Validators.max(10)]],
        connectionTimeout: [{value: null, disabled: true}, [Validators.min(0)]],
        requestTimeout: [{value: null, disabled: true}, [Validators.min(0)]],
        maxRetries: [{value: null, disabled: true}, [Validators.min(0), Validators.max(10)]],
        messageRetentionPeriod: [{value: null, disabled: true}, [Validators.min(60), Validators.max(1209600)]]
      })
    }, {validators: this.sqsQueueIdentifierValidator});

    formGroup.get('enabled').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => this.updateSqsFormState(formGroup, value, formGroup.get('queueType').value));

    formGroup.get('queueType').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => this.updateSqsFormState(formGroup, formGroup.get('enabled').value, value));

    return formGroup;
  }

  private updateSqsFormState(formGroup: FormGroup, enabled: boolean, queueType: SqsQueueType): void {
    const advanced = formGroup.get('advanced') as FormGroup;
    const controlNames = ['region', 'accessKeyId', 'secretAccessKey', 'sessionToken', 'queueName', 'queueUrl', 'queueType'];
    if (enabled) {
      controlNames.forEach(name => formGroup.get(name).enable({emitEvent: false}));
      Object.keys(advanced.controls).forEach(name => advanced.get(name).enable({emitEvent: false}));
      if (queueType === SqsQueueType.FIFO) {
        formGroup.get('messageGroupId').enable({emitEvent: false});
        formGroup.get('useContentBasedDeduplication').enable({emitEvent: false});
        formGroup.get('queueName').setValidators([Validators.pattern(sqsFifoQueueNamePattern)]);
      } else {
        formGroup.get('messageGroupId').disable({emitEvent: false});
        formGroup.get('messageGroupId').reset('', {emitEvent: false});
        formGroup.get('useContentBasedDeduplication').disable({emitEvent: false});
        formGroup.get('useContentBasedDeduplication').reset(false, {emitEvent: false});
        formGroup.get('queueName').setValidators([]);
      }
      formGroup.get('queueName').updateValueAndValidity({emitEvent: false});
    } else {
      controlNames.forEach(name => formGroup.get(name).disable({emitEvent: false}));
      Object.keys(advanced.controls).forEach(name => advanced.get(name).disable({emitEvent: false}));
      formGroup.get('messageGroupId').disable({emitEvent: false});
      formGroup.get('useContentBasedDeduplication').disable({emitEvent: false});
    }
  }

  private sqsQueueIdentifierValidator(group: FormGroup): ValidationErrors | null {
    const queueName = group.get('queueName')?.value;
    const queueUrl = group.get('queueUrl')?.value;
    if (group.get('enabled')?.value && !queueName && !queueUrl) {
      return {queueIdentifierRequired: true};
    }
    return null;
  }

  secretAccessKeyPlaceholder(): string {
    const control = this.deviceConnectivitySettingsForm?.get('sqs.secretAccessKeySet');
    return control && control.value ? '••••••••' : '';
  }

  testSqsConnection(): void {
    const sqsFormGroup = this.deviceConnectivitySettingsForm.get('sqs');
    const value: DeviceConnectivitySqsInfo = sqsFormGroup.getRawValue();
    const advanced = value['advanced'] || {};
    const request: TestSqsConnectionRequest = {
      region: value.region,
      accessKeyId: value.accessKeyId,
      secretAccessKey: value.secretAccessKey,
      sessionToken: value.sessionToken,
      queueName: value.queueName,
      queueUrl: value.queueUrl,
      queueType: value.queueType,
      endpointOverride: advanced.endpointOverride,
      connectionTimeout: advanced.connectionTimeout,
      requestTimeout: advanced.requestTimeout
    };
    this.isTestingSqsConnection$.next(true);
    this.adminService.testSqsConnection(request).subscribe({
      next: () => {
        this.isTestingSqsConnection$.next(false);
        this.store.dispatch(new ActionNotificationShow({
          message: this.translate.instant('admin.device-connectivity.test-connection-success'),
          type: 'success'
        }));
      },
      error: error => {
        this.isTestingSqsConnection$.next(false);
        this.store.dispatch(new ActionNotificationShow({
          message: error?.error?.message || this.translate.instant('admin.device-connectivity.test-connection-failed'),
          type: 'error'
        }));
      }
    });
  }

  private buildDeviceConnectivityInfoForm(): FormGroup {
    const formGroup = this.fb.group({
      enabled: [false, []],
      host: [{value: '', disabled: true}],
      port: [{value: null, disabled: true}, [Validators.min(1), Validators.max(65535), Validators.pattern('[0-9]*')]]
    });
    formGroup.get('enabled').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => {
      if (value) {
        formGroup.get('host').enable({emitEvent: false});
        formGroup.get('port').enable({emitEvent: false});
      } else {
        formGroup.get('host').disable({emitEvent: false});
        formGroup.get('port').disable({emitEvent: false});
      }
    });
    return formGroup;
  }

  save(): void {
    this.adminSettings.jsonValue = {...this.adminSettings.jsonValue, ...this.generalSettings.value};
    this.adminService.saveAdminSettings(this.adminSettings)
      .subscribe(adminSettings => this.processGeneralSettings(adminSettings));
  }

  saveDeviceConnectivitySettings(): void {
    const formValue = this.deviceConnectivitySettingsForm.getRawValue();
    const secretAccessKeyControl = this.deviceConnectivitySettingsForm.get('sqs.secretAccessKey');
    if (formValue.sqs && !secretAccessKeyControl.dirty) {
      delete formValue.sqs.secretAccessKey;
    }
    this.deviceConnectivitySettings.jsonValue = {
      ...this.deviceConnectivitySettings.jsonValue,
      ...formValue
    };
    this.adminService.saveAdminSettings<DeviceConnectivitySettings>(this.deviceConnectivitySettings)
      .subscribe(deviceConnectivitySettings => this.processDeviceConnectivitySettings(deviceConnectivitySettings));
  }

  discardGeneralSettings(): void {
    this.generalSettings.reset(this.adminSettings.jsonValue);
  }

  discardDeviceConnectivitySettings(): void {
    this.deviceConnectivitySettingsForm.reset(this.deviceConnectivitySettings.jsonValue);
  }

  private processGeneralSettings(generalSettings: AdminSettings<GeneralSettings>): void {
    this.adminSettings = generalSettings;
    this.generalSettings.reset(this.adminSettings.jsonValue);
  }

  private processDeviceConnectivitySettings(deviceConnectivitySettings: AdminSettings<DeviceConnectivitySettings>): void {
    this.deviceConnectivitySettings = deviceConnectivitySettings;
    const jsonValue = {...this.deviceConnectivitySettings.jsonValue};
    if (jsonValue.sqs) {
      // Defensive: the server must never echo back a real secret; strip it in case a backend stub returns one.
      jsonValue.sqs = {...jsonValue.sqs, secretAccessKey: ''};
    }
    this.deviceConnectivitySettingsForm.reset(jsonValue);
  }

  confirmForm(): FormGroup {
    return this.generalSettings.dirty ? this.generalSettings : this.deviceConnectivitySettingsForm;
  }

}
