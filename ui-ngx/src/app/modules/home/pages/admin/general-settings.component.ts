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
  SqsSettings,
  SqsQueueType
} from '@shared/models/settings.models';
import { AdminService } from '@core/http/admin.service';
import { HasConfirmForm } from '@core/guards/confirm-on-exit.guard';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NotificationService } from '@core/services/notification.service';

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
  sqsQueueTypes = Object.values(SqsQueueType);
  testingSqsConnection = false;

  private adminSettings: AdminSettings<GeneralSettings>;
  private deviceConnectivitySettings: AdminSettings<DeviceConnectivitySettings>;
  private sqsSettings: AdminSettings<SqsSettings>;

  private readonly destroy$ = new Subject<void>();

  constructor(protected store: Store<AppState>,
              private adminService: AdminService,
              private notificationService: NotificationService,
              public fb: FormBuilder) {
    super(store);
    this.buildGeneralServerSettingsForm();
    this.adminService.getAdminSettings<GeneralSettings>('general')
      .subscribe(adminSettings => this.processGeneralSettings(adminSettings));
    this.buildDeviceConnectivitySettingsForm();
    this.adminService.getAdminSettings<DeviceConnectivitySettings>('connectivity')
      .subscribe(deviceConnectivitySettings => this.processDeviceConnectivitySettings(deviceConnectivitySettings));
    this.buildSqsSettingsForm();
    this.adminService.getAdminSettings<SqsSettings>('sqs')
      .subscribe(sqsSettings => this.processSqsSettings(sqsSettings), error => {
        // SQS settings might not exist yet
        this.processSqsSettings(null);
      });
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
    this.sqsSettingsForm = this.fb.group({
      enabled: [false, []],
      region: [{value: '', disabled: true}, [Validators.required]],
      accessKeyId: [{value: '', disabled: true}, [Validators.required]],
      secretAccessKey: [{value: '', disabled: true}, [Validators.required]],
      queueUrl: [{value: '', disabled: true}, [Validators.required]],
      queueName: [{value: '', disabled: true}],
      queueType: [{value: SqsQueueType.STANDARD, disabled: true}, [Validators.required]],
      messageGroupId: [{value: '', disabled: true}],
      contentBasedDeduplication: [{value: false, disabled: true}],
      endpointOverride: [{value: '', disabled: true}],
      visibilityTimeoutSeconds: [{value: 30, disabled: true}, [Validators.min(0), Validators.max(43200)]],
      pollingWaitTimeSeconds: [{value: 20, disabled: true}, [Validators.min(0), Validators.max(20)]],
      maxNumberOfMessages: [{value: 10, disabled: true}, [Validators.min(1), Validators.max(10)]],
      connectionTimeoutMs: [{value: 10000, disabled: true}],
      requestTimeoutMs: [{value: 5000, disabled: true}],
      maxRetries: [{value: 3, disabled: true}]
    });

    this.sqsSettingsForm.get('enabled').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => {
      const controls = ['region', 'accessKeyId', 'secretAccessKey', 'queueUrl', 'queueName',
                        'queueType', 'messageGroupId', 'contentBasedDeduplication', 'endpointOverride',
                        'visibilityTimeoutSeconds', 'pollingWaitTimeSeconds', 'maxNumberOfMessages',
                        'connectionTimeoutMs', 'requestTimeoutMs', 'maxRetries'];
      controls.forEach(controlName => {
        if (value) {
          this.sqsSettingsForm.get(controlName).enable({emitEvent: false});
        } else {
          this.sqsSettingsForm.get(controlName).disable({emitEvent: false});
        }
      });
      this.updateFifoConditionalValidators();
    });

    this.sqsSettingsForm.get('queueType').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updateFifoConditionalValidators();
    });

    return this.sqsSettingsForm;
  }

  private updateFifoConditionalValidators(): void {
    const queueType = this.sqsSettingsForm.get('queueType')?.value;
    const messageGroupIdControl = this.sqsSettingsForm.get('messageGroupId');

    if (queueType === SqsQueueType.FIFO) {
      messageGroupIdControl?.setValidators([Validators.required]);
    } else {
      messageGroupIdControl?.clearValidators();
      messageGroupIdControl?.reset();
    }
    messageGroupIdControl?.updateValueAndValidity({emitEvent: false});
  }

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
    if (!this.sqsSettingsForm.valid) {
      return;
    }

    const formValue = this.sqsSettingsForm.getRawValue();
    // If secretAccessKey is pristine (not modified), omit it so the server will keep the existing one
    if (!this.sqsSettingsForm.get('secretAccessKey').dirty) {
      delete formValue.secretAccessKey;
    }

    this.sqsSettings.jsonValue = {
      ...this.sqsSettings.jsonValue,
      ...formValue
    };

    this.adminService.saveAdminSettings<SqsSettings>(this.sqsSettings)
      .subscribe(
        sqsSettings => {
          this.processSqsSettings(sqsSettings);
          this.notificationService.success(this.translate('admin.sqs.settings-saved'));
        },
        error => {
          this.notificationService.error(this.translate('admin.sqs.settings-save-error'));
        }
      );
  }

  discardSqsSettings(): void {
    this.sqsSettingsForm.reset(this.sqsSettings?.jsonValue || {});
  }

  testSqsConnection(): void {
    if (!this.sqsSettingsForm.valid) {
      return;
    }

    this.testingSqsConnection = true;
    const formValue = this.sqsSettingsForm.getRawValue();

    const testSettings: AdminSettings<SqsSettings> = {
      key: 'sqs',
      jsonValue: formValue
    };

    this.adminService.sendTestSqs(testSettings)
      .subscribe(
        () => {
          this.testingSqsConnection = false;
          this.notificationService.success(this.translate('admin.sqs.connection-success'));
        },
        error => {
          this.testingSqsConnection = false;
          const errorMessage = error?.error?.message || error?.message || this.translate('admin.sqs.connection-failed');
          this.notificationService.error(errorMessage);
        }
      );
  }

  private processSqsSettings(sqsSettings: AdminSettings<SqsSettings>): void {
    if (!sqsSettings) {
      // Create default SQS settings if none exist
      this.sqsSettings = {
        key: 'sqs',
        jsonValue: {
          enabled: false,
          region: 'us-east-1',
          accessKeyId: '',
          queueUrl: '',
          queueType: SqsQueueType.STANDARD,
          visibilityTimeoutSeconds: 30,
          pollingWaitTimeSeconds: 20,
          maxNumberOfMessages: 10,
          connectionTimeoutMs: 10000,
          requestTimeoutMs: 5000,
          maxRetries: 3
        }
      };
    } else {
      this.sqsSettings = sqsSettings;
    }
    this.sqsSettingsForm.reset(this.sqsSettings.jsonValue);
  }

  private processGeneralSettings(generalSettings: AdminSettings<GeneralSettings>): void {
    this.adminSettings = generalSettings;
    this.generalSettings.reset(this.adminSettings.jsonValue);
  }

  private processDeviceConnectivitySettings(deviceConnectivitySettings: AdminSettings<DeviceConnectivitySettings>): void {
    this.deviceConnectivitySettings = deviceConnectivitySettings;
    this.deviceConnectivitySettingsForm.reset(this.deviceConnectivitySettings.jsonValue);
  }

  confirmForm(): FormGroup {
    if (this.generalSettings.dirty) {
      return this.generalSettings;
    } else if (this.deviceConnectivitySettingsForm.dirty) {
      return this.deviceConnectivitySettingsForm;
    } else if (this.sqsSettingsForm.dirty) {
      return this.sqsSettingsForm;
    }
    return this.generalSettings;
  }

}
