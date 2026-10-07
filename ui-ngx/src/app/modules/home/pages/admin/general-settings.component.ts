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
  GeneralSettings,
  SqsConnectivitySettings,
  SqsConnectivityInfo,
  TestSqsConnectionRequest,
  SqsQueueType
} from '@shared/models/settings.models';
import { AdminService } from '@core/http/admin.service';
import { HasConfirmForm } from '@core/guards/confirm-on-exit.guard';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ActionNotificationShow } from '@core/notification/notification.actions';

@Component({
    selector: 'tb-general-settings',
    templateUrl: './general-settings.component.html',
    styleUrls: ['./general-settings.component.scss', './settings-card.scss'],
    standalone: false
})
export class GeneralSettingsComponent extends PageComponent implements HasConfirmForm, OnDestroy {

  generalSettings: FormGroup;
  deviceConnectivitySettingsForm: FormGroup;
  sqsSettingsForm: FormGroup;

  protocol: DeviceConnectivityProtocol = 'http';
  isTestingSqsConnection = false;

  private adminSettings: AdminSettings<GeneralSettings>;
  private deviceConnectivitySettings: AdminSettings<DeviceConnectivitySettings>;
  private sqsSettings: AdminSettings<SqsConnectivitySettings>;

  private readonly destroy$ = new Subject<void>();

  constructor(protected store: Store<AppState>,
              private adminService: AdminService,
              public fb: FormBuilder) {
    super(store);
    this.buildGeneralServerSettingsForm();
    this.adminService.getAdminSettings<GeneralSettings>('general')
      .subscribe(adminSettings => this.processGeneralSettings(adminSettings));
    this.buildDeviceConnectivitySettingsForm();
    this.adminService.getAdminSettings<DeviceConnectivitySettings>('connectivity')
      .subscribe(deviceConnectivitySettings => this.processDeviceConnectivitySettings(deviceConnectivitySettings));
    this.buildSqsSettingsForm();
    this.adminService.getAdminSettings<SqsConnectivitySettings>('connectivitySqs')
      .subscribe(sqsSettings => this.processSqsSettings(sqsSettings));
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
      coaps: this.buildDeviceConnectivityInfoForm()
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
      region: [{value: 'us-east-1', disabled: true}, [Validators.required, Validators.pattern('^[a-z]{2}-[a-z]+-\\d{1}$')]],
      accessKeyId: [{value: '', disabled: true}, [Validators.required]],
      secretAccessKey: [{value: '', disabled: true}],
      sessionToken: [{value: '', disabled: true}],
      queueName: [{value: '', disabled: true}],
      queueUrl: [{value: '', disabled: true}],
      queueType: [{value: 'STANDARD', disabled: true}],
      messageGroupId: [{value: '', disabled: true}],
      useContentBasedDeduplication: [{value: false, disabled: true}],
      messageRetentionPeriod: [{value: 345600, disabled: true}, [Validators.min(60), Validators.max(1209600)]],
      endpointOverride: [{value: '', disabled: true}],
      visibilityTimeout: [{value: '', disabled: true}, [Validators.min(0), Validators.max(43200)]],
      pollingWaitTimeSeconds: [{value: '', disabled: true}, [Validators.min(0), Validators.max(20)]],
      maxMessagesPerPoll: [{value: '', disabled: true}, [Validators.min(1), Validators.max(10)]],
      connectionTimeout: [{value: '', disabled: true}],
      retryAttempts: [{value: '', disabled: true}, [Validators.min(0), Validators.max(10)]]
    }, {validators: this.queueIdentifierValidator});

    // Handle enabled toggle
    formGroup.get('enabled').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => {
      const fields = ['region', 'accessKeyId', 'secretAccessKey', 'sessionToken',
                     'queueName', 'queueUrl', 'queueType', 'messageGroupId',
                     'useContentBasedDeduplication', 'messageRetentionPeriod',
                     'endpointOverride', 'visibilityTimeout', 'pollingWaitTimeSeconds',
                     'maxMessagesPerPoll', 'connectionTimeout', 'retryAttempts'];
      fields.forEach(field => {
        if (value) {
          formGroup.get(field).enable({emitEvent: false});
        } else {
          formGroup.get(field).disable({emitEvent: false});
        }
      });
    });

    // Handle queueType changes for FIFO-specific fields
    formGroup.get('queueType').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(queueType => {
      const isFifo = queueType === 'FIFO';
      if (isFifo) {
        formGroup.get('messageGroupId').enable({emitEvent: false});
        formGroup.get('useContentBasedDeduplication').enable({emitEvent: false});
      } else {
        formGroup.get('messageGroupId').disable({emitEvent: false});
        formGroup.get('useContentBasedDeduplication').disable({emitEvent: false});
        formGroup.get('messageGroupId').reset('', {emitEvent: false});
        formGroup.get('useContentBasedDeduplication').reset(false, {emitEvent: false});
      }
    });

    return formGroup;
  }

  private queueIdentifierValidator = (formGroup: FormGroup) => {
    if (!formGroup.get('enabled').value) {
      return null;
    }
    const queueName = formGroup.get('queueName').value;
    const queueUrl = formGroup.get('queueUrl').value;
    if (!queueName && !queueUrl) {
      return {queueIdentifierRequired: true};
    }
    return null;
  };

  save(): void {
    this.adminSettings.jsonValue = {...this.adminSettings.jsonValue, ...this.generalSettings.value};
    this.adminService.saveAdminSettings(this.adminSettings)
      .subscribe(adminSettings => this.processGeneralSettings(adminSettings));
  }

  saveDeviceConnectivitySettings(): void {
    this.deviceConnectivitySettings.jsonValue = {
      ...this.deviceConnectivitySettings.jsonValue,
      ...this.deviceConnectivitySettingsForm.getRawValue()
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

  saveSqsSettings(): void {
    const sqsValue = this.processSqsSettingsValue(this.sqsSettingsForm.getRawValue());
    this.sqsSettings.jsonValue = {
      ...this.sqsSettings.jsonValue,
      ...sqsValue
    };
    this.adminService.saveAdminSettings<SqsConnectivitySettings>(this.sqsSettings)
      .subscribe(sqsSettings => this.processSqsSettings(sqsSettings));
  }

  discardSqsSettings(): void {
    this.sqsSettingsForm.reset(this.sqsSettings.jsonValue);
  }

  testSqsConnection(): void {
    if (this.sqsSettingsForm.invalid) {
      return;
    }
    this.isTestingSqsConnection = true;
    const testRequest = this.buildTestSqsConnectionRequest();
    this.adminService.sendTestSqsConnection(testRequest)
      .pipe(finalize(() => this.isTestingSqsConnection = false))
      .subscribe({
        next: () => {
          this.store.dispatch(new ActionNotificationShow({
            message: 'admin.sqs.test-connection-success',
            type: 'success'
          }));
        },
        error: (error) => {
          this.store.dispatch(new ActionNotificationShow({
            message: 'admin.sqs.test-connection-failed',
            type: 'error'
          }));
        }
      });
  }

  private processSqsSettingsValue(value: any): Partial<SqsConnectivityInfo> {
    const processed = {...value};
    // Don't resend secretAccessKey if it wasn't changed
    if (this.sqsSettingsForm.get('secretAccessKey').pristine) {
      delete processed.secretAccessKey;
    }
    // Remove empty optional fields
    if (!processed.sessionToken) {
      delete processed.sessionToken;
    }
    if (!processed.messageGroupId) {
      delete processed.messageGroupId;
    }
    if (!processed.endpointOverride) {
      delete processed.endpointOverride;
    }
    if (!processed.visibilityTimeout) {
      delete processed.visibilityTimeout;
    }
    if (!processed.pollingWaitTimeSeconds) {
      delete processed.pollingWaitTimeSeconds;
    }
    if (!processed.maxMessagesPerPoll) {
      delete processed.maxMessagesPerPoll;
    }
    if (!processed.connectionTimeout) {
      delete processed.connectionTimeout;
    }
    if (!processed.retryAttempts) {
      delete processed.retryAttempts;
    }
    return processed;
  }

  private buildTestSqsConnectionRequest(): TestSqsConnectionRequest {
    const value = this.sqsSettingsForm.getRawValue();
    const request: TestSqsConnectionRequest = {
      region: value.region,
      accessKeyId: value.accessKeyId,
      secretAccessKey: value.secretAccessKey,
      queueName: value.queueName || undefined,
      queueUrl: value.queueUrl || undefined
    };
    if (value.sessionToken) {
      request.sessionToken = value.sessionToken;
    }
    if (value.endpointOverride) {
      request.endpointOverride = value.endpointOverride;
    }
    return request;
  }

  private processGeneralSettings(generalSettings: AdminSettings<GeneralSettings>): void {
    this.adminSettings = generalSettings;
    this.generalSettings.reset(this.adminSettings.jsonValue);
  }

  private processDeviceConnectivitySettings(deviceConnectivitySettings: AdminSettings<DeviceConnectivitySettings>): void {
    this.deviceConnectivitySettings = deviceConnectivitySettings;
    this.deviceConnectivitySettingsForm.reset(this.deviceConnectivitySettings.jsonValue);
  }

  private processSqsSettings(sqsSettings: AdminSettings<SqsConnectivitySettings>): void {
    this.sqsSettings = sqsSettings;
    this.sqsSettingsForm.reset(this.sqsSettings.jsonValue);
  }

  confirmForm(): FormGroup {
    if (this.generalSettings.dirty) {
      return this.generalSettings;
    }
    if (this.deviceConnectivitySettingsForm.dirty) {
      return this.deviceConnectivitySettingsForm;
    }
    if (this.sqsSettingsForm.dirty) {
      return this.sqsSettingsForm;
    }
    return this.generalSettings;
  }

}
