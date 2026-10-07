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
  DeviceConnectivitySqsInfo,
  GeneralSettings,
  SqsQueueType,
  sqsQueueTypeTranslationMap
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

  protocol: DeviceConnectivityProtocol | 'sqs' = 'http';

  sqsQueueTypes = Object.values(SqsQueueType);
  sqsQueueTypeTranslationMap = sqsQueueTypeTranslationMap;

  testingSqsConnection = false;
  sqsTestResult: 'success' | 'failure' | null = null;
  sqsTestErrorMessage = '';

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
      sqs: this.buildDeviceConnectivitySqsInfoForm()
    });
  }

  private buildDeviceConnectivitySqsInfoForm(): FormGroup {
    const formGroup = this.fb.group({
      enabled: [false, []],
      region: [{value: 'us-east-1', disabled: true}, [Validators.required]],
      accessKeyId: [{value: '', disabled: true}, [Validators.required]],
      secretAccessKey: [{value: '', disabled: true}],
      showChangeSecret: [false],
      changeSecret: [false],
      sessionToken: [{value: '', disabled: true}],
      queueName: [{value: '', disabled: true}, [Validators.required]],
      queueUrl: [{value: '', disabled: true}, [Validators.pattern(/^https?:\/\/.+/)]],
      queueType: [{value: SqsQueueType.STANDARD, disabled: true}, [Validators.required]],
      messageGroupId: [{value: '', disabled: true}],
      contentBasedDeduplication: [{value: false, disabled: true}],
      endpoint: [{value: '', disabled: true}, [Validators.pattern(/^https?:\/\/.+/)]],
      visibilityTimeoutSeconds: [{value: 30, disabled: true}, [Validators.min(0), Validators.max(43200)]],
      pollingWaitTimeSeconds: [{value: 20, disabled: true}, [Validators.min(0), Validators.max(20)]],
      maxNumberOfMessages: [{value: 10, disabled: true}, [Validators.min(1), Validators.max(10)]],
      messageRetentionPeriodSeconds: [{value: 345600, disabled: true}, [Validators.min(60), Validators.max(1209600)]],
      connectionTimeoutMs: [{value: 10000, disabled: true}, [Validators.min(0)]],
      requestTimeoutMs: [{value: 10000, disabled: true}, [Validators.min(0)]],
      maxRetryAttempts: [{value: 3, disabled: true}, [Validators.min(0), Validators.max(10)]]
    });

    const setEnabled = (enabled: boolean) => {
      const controls = ['region', 'accessKeyId', 'sessionToken', 'queueName', 'queueUrl', 'queueType',
        'endpoint', 'visibilityTimeoutSeconds', 'pollingWaitTimeSeconds', 'maxNumberOfMessages',
        'messageRetentionPeriodSeconds', 'connectionTimeoutMs', 'requestTimeoutMs', 'maxRetryAttempts'];
      controls.forEach(name => {
        if (enabled) {
          formGroup.get(name).enable({emitEvent: false});
        } else {
          formGroup.get(name).disable({emitEvent: false});
        }
      });
      this.updateSqsSecretControlState(formGroup, enabled);
      this.updateSqsFifoControlsState(formGroup, enabled);
    };

    formGroup.get('enabled').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => setEnabled(value));

    formGroup.get('queueType').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.updateSqsFifoControlsState(formGroup, formGroup.get('enabled').value));

    formGroup.get('changeSecret').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.updateSqsSecretControlState(formGroup, formGroup.get('enabled').value));

    return formGroup;
  }

  private updateSqsSecretControlState(formGroup: FormGroup, enabled: boolean): void {
    const secretControl = formGroup.get('secretAccessKey');
    const showChangeSecret = formGroup.get('showChangeSecret').value;
    const changeSecret = formGroup.get('changeSecret').value;
    if (enabled && (!showChangeSecret || changeSecret)) {
      secretControl.enable({emitEvent: false});
    } else {
      secretControl.disable({emitEvent: false});
    }
  }

  private updateSqsFifoControlsState(formGroup: FormGroup, enabled: boolean): void {
    const isFifo = formGroup.get('queueType').value === SqsQueueType.FIFO;
    const messageGroupIdControl = formGroup.get('messageGroupId');
    const dedupControl = formGroup.get('contentBasedDeduplication');
    if (enabled && isFifo) {
      messageGroupIdControl.enable({emitEvent: false});
      dedupControl.enable({emitEvent: false});
      messageGroupIdControl.setValidators([Validators.required]);
    } else {
      messageGroupIdControl.disable({emitEvent: false});
      dedupControl.disable({emitEvent: false});
      messageGroupIdControl.clearValidators();
    }
    messageGroupIdControl.updateValueAndValidity({emitEvent: false});
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
    const sqs = {...formValue.sqs};
    // Do not resend an untouched secret: only send secretAccessKey when the admin explicitly changed it
    // (or it was never previously saved).
    if (sqs.showChangeSecret && !sqs.changeSecret) {
      delete sqs.secretAccessKey;
    }
    delete sqs.showChangeSecret;
    delete sqs.changeSecret;
    formValue.sqs = sqs;
    this.deviceConnectivitySettings.jsonValue = {
      ...this.deviceConnectivitySettings.jsonValue,
      ...formValue
    };
    this.adminService.saveAdminSettings<DeviceConnectivitySettings>(this.deviceConnectivitySettings)
      .subscribe(deviceConnectivitySettings => this.processDeviceConnectivitySettings(deviceConnectivitySettings));
  }

  testSqsConnection(): void {
    this.testingSqsConnection = true;
    this.sqsTestResult = null;
    this.sqsTestErrorMessage = '';
    const sqsValue: DeviceConnectivitySqsInfo = this.deviceConnectivitySettingsForm.get('sqs').getRawValue();
    this.adminService.testSqsConnection(sqsValue, {ignoreErrors: true, ignoreLoading: true}).subscribe({
      next: () => {
        this.testingSqsConnection = false;
        this.sqsTestResult = 'success';
      },
      error: error => {
        this.testingSqsConnection = false;
        this.sqsTestResult = 'failure';
        this.sqsTestErrorMessage = error?.error?.message || this.translate.instant('admin.device-connectivity.sqs.test-connection-failed');
        this.store.dispatch(new ActionNotificationShow({message: this.sqsTestErrorMessage, type: 'error'}));
      }
    });
  }

  discardGeneralSettings(): void {
    this.generalSettings.reset(this.adminSettings.jsonValue);
  }

  discardDeviceConnectivitySettings(): void {
    this.processDeviceConnectivitySettings(this.deviceConnectivitySettings);
  }

  private processGeneralSettings(generalSettings: AdminSettings<GeneralSettings>): void {
    this.adminSettings = generalSettings;
    this.generalSettings.reset(this.adminSettings.jsonValue);
  }

  private processDeviceConnectivitySettings(deviceConnectivitySettings: AdminSettings<DeviceConnectivitySettings>): void {
    this.deviceConnectivitySettings = deviceConnectivitySettings;
    const jsonValue = this.deviceConnectivitySettings.jsonValue || {} as DeviceConnectivitySettings;
    const sqs = jsonValue.sqs;
    const hasSecret = !isUndefinedOrNull(sqs?.secretAccessKey) && sqs.secretAccessKey !== '';
    const formValue = {
      ...jsonValue,
      sqs: {
        ...sqs,
        secretAccessKey: hasSecret ? '' : (sqs?.secretAccessKey || ''),
        showChangeSecret: hasSecret,
        changeSecret: false
      }
    };
    this.deviceConnectivitySettingsForm.reset(formValue);
  }

  confirmForm(): FormGroup {
    return this.generalSettings.dirty ? this.generalSettings : this.deviceConnectivitySettingsForm;
  }

}
