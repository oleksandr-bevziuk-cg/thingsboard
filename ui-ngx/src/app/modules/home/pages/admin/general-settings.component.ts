// SPDX-FileCopyrightText: Copyright The ThingsBoard Authors
// SPDX-License-Identifier: Apache-2.0
import { Component, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { PageComponent } from '@shared/components/page.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  AdminSettings,
  AwsSqsIntegrationSettings,
  DeviceConnectivityProtocol,
  DeviceConnectivitySettings,
  GeneralSettings,
  SQSQueueType
} from '@shared/models/settings.models';
import { AdminService } from '@core/http/admin.service';
import { HasConfirmForm } from '@core/guards/confirm-on-exit.guard';
import { ToastNotificationService } from '@core/services/toast-notification.service';
import { NotificationMessage, NotificationType } from '@core/notification/notification.models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'tb-general-settings',
    templateUrl: './general-settings.component.html',
    styleUrls: ['./general-settings.component.scss', './settings-card.scss'],
    standalone: false
})
export class GeneralSettingsComponent extends PageComponent implements HasConfirmForm, OnDestroy {

  generalSettings: FormGroup;
  deviceConnectivitySettingsForm: FormGroup;
  awsSqsSettingsForm: FormGroup;

  protocol: DeviceConnectivityProtocol = 'http';
  sqsQueueTypes: SQSQueueType[] = ['STANDARD', 'FIFO'];

  private adminSettings: AdminSettings<GeneralSettings>;
  private deviceConnectivitySettings: AdminSettings<DeviceConnectivitySettings>;
  private awsSqsSettings: AdminSettings<AwsSqsIntegrationSettings>;

  private readonly destroy$ = new Subject<void>();

  constructor(protected store: Store<AppState>,
              private adminService: AdminService,
              public fb: FormBuilder,
              private toastNotificationService: ToastNotificationService,
              private translate: TranslateService) {
    super(store);
    this.buildGeneralServerSettingsForm();
    this.adminService.getAdminSettings<GeneralSettings>('general')
      .subscribe(adminSettings => this.processGeneralSettings(adminSettings));
    this.buildDeviceConnectivitySettingsForm();
    this.adminService.getAdminSettings<DeviceConnectivitySettings>('connectivity')
      .subscribe(deviceConnectivitySettings => this.processDeviceConnectivitySettings(deviceConnectivitySettings));
    this.buildAwsSqsSettingsForm();
    this.adminService.getAdminSettings<AwsSqsIntegrationSettings>('sqsIntegration')
      .subscribe(awsSqsSettings => this.processAwsSqsSettings(awsSqsSettings));
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

  private buildAwsSqsSettingsForm(): FormGroup {
    const formGroup = this.fb.group({
      enabled: [false, []],
      region: [{value: '', disabled: true}, [Validators.required]],
      accessKeyId: [{value: '', disabled: true}, [Validators.required]],
      secretAccessKey: [{value: '', disabled: true}, [Validators.required]],
      queueName: [{value: '', disabled: true}],
      queueUrl: [{value: '', disabled: true}],
      queueType: [{value: 'STANDARD', disabled: true}],
      messageGroupId: [{value: '', disabled: true}],
      deduplicationId: [{value: '', disabled: true}],
      endpointOverride: [{value: '', disabled: true}],
      messageVisibilityTimeout: [{value: 30, disabled: true}, [Validators.min(0), Validators.max(43200)]],
      pollingWaitTime: [{value: 20, disabled: true}, [Validators.min(0), Validators.max(20)]],
      maxMessagesPerPoll: [{value: 10, disabled: true}, [Validators.min(1), Validators.max(10)]],
      retryMaxAttempts: [{value: 3, disabled: true}, [Validators.min(0)]],
      retryBackoffMs: [{value: 100, disabled: true}, [Validators.min(0)]]
    });
    formGroup.get('enabled').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => {
      const controls = ['region', 'accessKeyId', 'secretAccessKey', 'queueName', 'queueUrl', 'queueType',
        'messageGroupId', 'deduplicationId', 'endpointOverride', 'messageVisibilityTimeout',
        'pollingWaitTime', 'maxMessagesPerPoll', 'retryMaxAttempts', 'retryBackoffMs'];
      if (value) {
        controls.forEach(controlName => {
          const control = formGroup.get(controlName);
          if (control) {
            control.enable({emitEvent: false});
          }
        });
      } else {
        controls.forEach(controlName => {
          const control = formGroup.get(controlName);
          if (control) {
            control.disable({emitEvent: false});
          }
        });
      }
    });
    formGroup.get('queueType').valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => {
      const messageGroupIdControl = formGroup.get('messageGroupId');
      const deduplicationIdControl = formGroup.get('deduplicationId');
      if (value === 'FIFO') {
        messageGroupIdControl.setValidators([Validators.required]);
        messageGroupIdControl.updateValueAndValidity({emitEvent: false});
      } else {
        messageGroupIdControl.clearValidators();
        messageGroupIdControl.updateValueAndValidity({emitEvent: false});
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

  saveAwsSqsSettings(): void {
    this.awsSqsSettings.jsonValue = {
      ...this.awsSqsSettings.jsonValue,
      ...this.awsSqsSettingsForm.getRawValue()
    };
    this.adminService.saveAdminSettings<AwsSqsIntegrationSettings>(this.awsSqsSettings)
      .subscribe(awsSqsSettings => this.processAwsSqsSettings(awsSqsSettings));
  }

  discardAwsSqsSettings(): void {
    this.awsSqsSettingsForm.reset(this.awsSqsSettings.jsonValue);
  }

  testAwsSqsConnection(): void {
    if (this.awsSqsSettingsForm.invalid) {
      return;
    }
    const settings = this.awsSqsSettingsForm.getRawValue();
    this.adminService.testAwsSqsConnection(settings).subscribe(
      () => {
        this.toastNotificationService.dispatchNotification(
          new NotificationMessage(
            this.translate.instant('admin.aws-sqs.connection-test-success'),
            NotificationType.SUCCESS
          )
        );
      },
      error => {
        let errorMessage = this.translate.instant('admin.aws-sqs.connection-test-failed');
        if (error && error.error && error.error.message) {
          errorMessage += ': ' + error.error.message;
        }
        this.toastNotificationService.dispatchNotification(
          new NotificationMessage(
            errorMessage,
            NotificationType.ERROR
          )
        );
      }
    );
  }

  private processGeneralSettings(generalSettings: AdminSettings<GeneralSettings>): void {
    this.adminSettings = generalSettings;
    this.generalSettings.reset(this.adminSettings.jsonValue);
  }

  private processDeviceConnectivitySettings(deviceConnectivitySettings: AdminSettings<DeviceConnectivitySettings>): void {
    this.deviceConnectivitySettings = deviceConnectivitySettings;
    this.deviceConnectivitySettingsForm.reset(this.deviceConnectivitySettings.jsonValue);
  }

  private processAwsSqsSettings(awsSqsSettings: AdminSettings<AwsSqsIntegrationSettings>): void {
    this.awsSqsSettings = awsSqsSettings;
    this.awsSqsSettingsForm.reset(this.awsSqsSettings.jsonValue);
  }

  confirmForm(): FormGroup {
    if (this.generalSettings.dirty) {
      return this.generalSettings;
    } else if (this.deviceConnectivitySettingsForm.dirty) {
      return this.deviceConnectivitySettingsForm;
    } else if (this.awsSqsSettingsForm.dirty) {
      return this.awsSqsSettingsForm;
    }
    return this.generalSettings;
  }

}
