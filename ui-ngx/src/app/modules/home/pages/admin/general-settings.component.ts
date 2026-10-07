// SPDX-FileCopyrightText: Copyright The ThingsBoard Authors
// SPDX-License-Identifier: Apache-2.0
import { Component, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { PageComponent } from '@shared/components/page.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  AdminSettings,
  DeviceConnectivityProtocol,
  DeviceConnectivitySettings,
  DeviceConnectivitySqsSettings,
  GeneralSettings,
  sqsFifoNamePattern,
  sqsRegionPattern,
  SqsQueueType,
  TestSqsConnectionRequest
} from '@shared/models/settings.models';
import { AdminService } from '@core/http/admin.service';
import { HasConfirmForm } from '@core/guards/confirm-on-exit.guard';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ActionNotificationShow } from '@core/notification/notification.actions';
import { TranslateService } from '@ngx-translate/core';
import { isUndefinedOrNull } from '@core/utils';

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

  testingSqsConnection = false;

  private adminSettings: AdminSettings<GeneralSettings>;
  private deviceConnectivitySettings: AdminSettings<DeviceConnectivitySettings>;

  private readonly destroy$ = new Subject<void>();

  constructor(protected store: Store<AppState>,
              private adminService: AdminService,
              private translate: TranslateService,
              public fb: FormBuilder) {
    super(store);
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
      sqs: this.buildSqsSettingsForm()
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

  private buildSqsSettingsForm(): FormGroup {
    const formGroup = this.fb.group({
      enabled: [false, []],
      region: [{value: 'us-east-1', disabled: true}, [Validators.required, Validators.pattern(sqsRegionPattern)]],
      accessKeyId: [{value: '', disabled: true}, [Validators.required]],
      secretAccessKey: [{value: '', disabled: true}, [Validators.required]],
      sessionToken: [{value: '', disabled: true}],
      queueName: [{value: '', disabled: true}],
      queueUrl: [{value: '', disabled: true}],
      queueType: [{value: SqsQueueType.STANDARD, disabled: true}, [Validators.required]],
      messageGroupId: [{value: '', disabled: true}],
      useContentBasedDeduplication: [{value: false, disabled: true}],
      advanced: this.fb.group({
        endpointOverride: [{value: '', disabled: true}],
        visibilityTimeoutSeconds: [{value: 30, disabled: true}, [Validators.required, Validators.min(0), Validators.max(43200)]],
        pollingWaitTimeSeconds: [{value: 20, disabled: true}, [Validators.required, Validators.min(0), Validators.max(20)]],
        maxMessagesPerPoll: [{value: 10, disabled: true}, [Validators.required, Validators.min(1), Validators.max(10)]],
        connectionTimeoutSeconds: [{value: 30, disabled: true}, [Validators.required, Validators.min(1)]],
        requestTimeoutSeconds: [{value: 30, disabled: true}, [Validators.required, Validators.min(1)]],
        maxRetries: [{value: 3, disabled: true}, [Validators.required, Validators.min(0), Validators.max(10)]],
        messageRetentionPeriodSeconds: [{value: null, disabled: true}, [Validators.min(60), Validators.max(1209600)]]
      })
    }, {validators: [this.sqsQueueIdentifierValidator]});

    formGroup.get('enabled').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => {
      const controls = ['region', 'accessKeyId', 'secretAccessKey', 'sessionToken', 'queueName', 'queueUrl',
        'queueType', 'messageGroupId', 'useContentBasedDeduplication'];
      if (value) {
        controls.forEach(name => formGroup.get(name).enable({emitEvent: false}));
        formGroup.get('advanced').enable({emitEvent: false});
      } else {
        controls.forEach(name => formGroup.get(name).disable({emitEvent: false}));
        formGroup.get('advanced').disable({emitEvent: false});
      }
    });

    formGroup.get('queueType').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => {
      const messageGroupIdControl = formGroup.get('messageGroupId');
      if (value === SqsQueueType.FIFO) {
        messageGroupIdControl.addValidators(Validators.required);
      } else {
        messageGroupIdControl.removeValidators(Validators.required);
      }
      messageGroupIdControl.updateValueAndValidity({emitEvent: false});
    });

    return formGroup;
  }

  private sqsQueueIdentifierValidator(group: FormGroup): { [key: string]: boolean } | null {
    const queueName = group.get('queueName')?.value;
    const queueUrl = group.get('queueUrl')?.value;
    if (!group.get('enabled')?.value) {
      return null;
    }
    if (!queueName && !queueUrl) {
      return {queueIdentifierRequired: true};
    }
    const queueType: SqsQueueType = group.get('queueType')?.value;
    if (queueType === SqsQueueType.FIFO) {
      const name = queueName || queueUrl || '';
      if (!sqsFifoNamePattern.test(name)) {
        return {fifoNameSuffixRequired: true};
      }
    }
    return null;
  }

  save(): void {
    this.adminSettings.jsonValue = {...this.adminSettings.jsonValue, ...this.generalSettings.value};
    this.adminService.saveAdminSettings(this.adminSettings)
      .subscribe(adminSettings => this.processGeneralSettings(adminSettings));
  }

  saveDeviceConnectivitySettings(): void {
    this.deviceConnectivitySettings.jsonValue = {
      ...this.deviceConnectivitySettings.jsonValue,
      ...this.deviceConnectivitySettingsFormValue
    };
    this.adminService.saveAdminSettings<DeviceConnectivitySettings>(this.deviceConnectivitySettings)
      .subscribe(deviceConnectivitySettings => this.processDeviceConnectivitySettings(deviceConnectivitySettings));
  }

  testSqsConnection(): void {
    const sqsFormGroup = this.deviceConnectivitySettingsForm.get('sqs') as FormGroup;
    if (sqsFormGroup.invalid || this.testingSqsConnection) {
      return;
    }
    this.testingSqsConnection = true;
    const testSqsConnectionRequest: TestSqsConnectionRequest = {
      sqs: this.sqsSettingsFormValue
    };
    this.adminService.testSqsConnection(testSqsConnectionRequest).subscribe({
      next: () => {
        this.testingSqsConnection = false;
        this.store.dispatch(new ActionNotificationShow({
          message: this.translate.instant('admin.device-connectivity.sqs.test-connection-success'),
          type: 'success'
        }));
      },
      error: error => {
        this.testingSqsConnection = false;
        this.store.dispatch(new ActionNotificationShow({
          message: error?.error?.message || this.translate.instant('admin.device-connectivity.sqs.test-connection-failed'),
          type: 'error'
        }));
      }
    });
  }

  private get sqsSettingsFormValue(): DeviceConnectivitySqsSettings {
    const sqsFormGroup = this.deviceConnectivitySettingsForm.get('sqs') as FormGroup;
    const formValue = sqsFormGroup.getRawValue() as DeviceConnectivitySqsSettings;
    if (sqsFormGroup.get('secretAccessKey').pristine) {
      delete formValue.secretAccessKey;
    } else if (isUndefinedOrNull(formValue.secretAccessKey)) {
      formValue.secretAccessKey = '';
    }
    return formValue;
  }

  private get deviceConnectivitySettingsFormValue(): DeviceConnectivitySettings {
    const formValue = this.deviceConnectivitySettingsForm.getRawValue() as DeviceConnectivitySettings;
    formValue.sqs = this.sqsSettingsFormValue;
    return formValue;
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
    this.deviceConnectivitySettingsForm.reset(this.deviceConnectivitySettings.jsonValue);
    const sqsFormGroup = this.deviceConnectivitySettingsForm.get('sqs');
    if (this.deviceConnectivitySettings.jsonValue?.sqs?.secretAccessKeyConfigured) {
      sqsFormGroup.get('secretAccessKey').markAsPristine();
    }
  }

  confirmForm(): FormGroup {
    return this.generalSettings.dirty ? this.generalSettings : this.deviceConnectivitySettingsForm;
  }

}
