// SPDX-FileCopyrightText: Copyright The ThingsBoard Authors
// SPDX-License-Identifier: Apache-2.0
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { GeneralSettingsComponent } from './general-settings.component';
import { AdminService } from '@core/http/admin.service';
import { SqsQueueType } from '@shared/models/settings.models';

describe('GeneralSettingsComponent (Amazon SQS section)', () => {
  let component: GeneralSettingsComponent;
  let fixture: ComponentFixture<GeneralSettingsComponent>;
  let adminServiceSpy: jasmine.SpyObj<AdminService>;

  const generalSettingsResponse = {
    id: {id: 'general'} as any,
    key: 'general',
    jsonValue: {baseUrl: 'http://localhost', prohibitDifferentUrl: false}
  };

  const connectivitySettingsResponse = {
    id: {id: 'connectivity'} as any,
    key: 'connectivity',
    jsonValue: {
      http: {enabled: false, host: '', port: null},
      https: {enabled: false, host: '', port: null},
      mqtt: {enabled: false, host: '', port: null},
      mqtts: {enabled: false, host: '', port: null},
      coap: {enabled: false, host: '', port: null},
      coaps: {enabled: false, host: '', port: null},
      sqs: {
        enabled: false,
        region: 'us-east-1',
        accessKeyId: '',
        secretAccessKeyConfigured: false,
        queueType: SqsQueueType.STANDARD,
        advanced: {
          visibilityTimeoutSeconds: 30,
          pollingWaitTimeSeconds: 20,
          maxMessagesPerPoll: 10,
          connectionTimeoutSeconds: 30,
          requestTimeoutSeconds: 30,
          maxRetries: 3
        }
      }
    }
  };

  beforeEach(async () => {
    adminServiceSpy = jasmine.createSpyObj('AdminService', [
      'getAdminSettings', 'saveAdminSettings', 'testSqsConnection'
    ]);
    adminServiceSpy.getAdminSettings.and.callFake((key: string) => {
      if (key === 'general') {
        return of(generalSettingsResponse) as any;
      }
      return of(connectivitySettingsResponse) as any;
    });

    await TestBed.configureTestingModule({
      declarations: [GeneralSettingsComponent],
      imports: [ReactiveFormsModule, TranslateModule.forRoot()],
      providers: [
        provideMockStore({}),
        {provide: AdminService, useValue: adminServiceSpy}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GeneralSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function sqsForm() {
    return component.deviceConnectivitySettingsForm.get('sqs');
  }

  it('should create the component and load SQS settings', () => {
    expect(component).toBeTruthy();
    expect(sqsForm().get('region').value).toBe('us-east-1');
  });

  it('should disable SQS controls when the section is disabled', () => {
    expect(sqsForm().get('enabled').value).toBe(false);
    expect(sqsForm().get('accessKeyId').disabled).toBe(true);
    expect(sqsForm().get('region').disabled).toBe(true);
  });

  it('should enable SQS controls and require fields once enabled', () => {
    sqsForm().get('enabled').setValue(true);
    fixture.detectChanges();
    expect(sqsForm().get('accessKeyId').disabled).toBe(false);
    expect(sqsForm().get('accessKeyId').valid).toBe(false);
    sqsForm().get('accessKeyId').setValue('');
    expect(sqsForm().get('accessKeyId').hasError('required')).toBe(true);
  });

  it('should validate the AWS region pattern', () => {
    sqsForm().get('enabled').setValue(true);
    const region = sqsForm().get('region');
    region.setValue('not-a-region!');
    expect(region.hasError('pattern')).toBe(true);
    region.setValue('us-east-1');
    expect(region.hasError('pattern')).toBe(false);
  });

  it('should require at least one of queue name or queue URL when enabled', () => {
    sqsForm().get('enabled').setValue(true);
    sqsForm().get('queueName').setValue('');
    sqsForm().get('queueUrl').setValue('');
    sqsForm().updateValueAndValidity();
    expect(sqsForm().hasError('queueIdentifierRequired')).toBe(true);
    sqsForm().get('queueName').setValue('my-queue');
    sqsForm().updateValueAndValidity();
    expect(sqsForm().hasError('queueIdentifierRequired')).toBe(false);
  });

  it('should require messageGroupId when queue type is FIFO and clear it when switched back to STANDARD', () => {
    sqsForm().get('enabled').setValue(true);
    sqsForm().get('queueType').setValue(SqsQueueType.FIFO);
    const messageGroupId = sqsForm().get('messageGroupId');
    messageGroupId.setValue('');
    expect(messageGroupId.hasError('required')).toBe(true);

    messageGroupId.setValue('group-1');
    sqsForm().get('queueType').setValue(SqsQueueType.STANDARD);
    expect(messageGroupId.hasError('required')).toBe(false);
    // Switching back should not have silently cleared the typed value.
    expect(messageGroupId.value).toBe('group-1');
  });

  it('should require queue name/url to end with .fifo for FIFO queues', () => {
    sqsForm().get('enabled').setValue(true);
    sqsForm().get('queueType').setValue(SqsQueueType.FIFO);
    sqsForm().get('queueName').setValue('my-queue');
    sqsForm().get('messageGroupId').setValue('group-1');
    sqsForm().updateValueAndValidity();
    expect(sqsForm().hasError('fifoNameSuffixRequired')).toBe(true);
    sqsForm().get('queueName').setValue('my-queue.fifo');
    sqsForm().updateValueAndValidity();
    expect(sqsForm().hasError('fifoNameSuffixRequired')).toBe(false);
  });

  it('should enforce numeric min/max bounds on advanced settings', () => {
    sqsForm().get('enabled').setValue(true);
    const advanced = sqsForm().get('advanced');
    advanced.get('maxMessagesPerPoll').setValue(11);
    expect(advanced.get('maxMessagesPerPoll').hasError('max')).toBe(true);
    advanced.get('maxMessagesPerPoll').setValue(0);
    expect(advanced.get('maxMessagesPerPoll').hasError('min')).toBe(true);
    advanced.get('maxMessagesPerPoll').setValue(10);
    expect(advanced.get('maxMessagesPerPoll').valid).toBe(true);
  });

  it('should keep the secret access key control pristine when left untouched, omitting it from the save payload', () => {
    sqsForm().get('enabled').setValue(true);
    expect(sqsForm().get('secretAccessKey').pristine).toBe(true);
    const payload: any = (component as any).sqsSettingsFormValue;
    expect(payload.hasOwnProperty('secretAccessKey')).toBe(false);
  });

  it('should include the secret access key in the save payload once it has been edited', () => {
    sqsForm().get('enabled').setValue(true);
    sqsForm().get('secretAccessKey').markAsDirty();
    sqsForm().get('secretAccessKey').setValue('new-secret');
    const payload: any = (component as any).sqsSettingsFormValue;
    expect(payload.secretAccessKey).toBe('new-secret');
  });

  it('should disable the Test connection action while the SQS form is invalid', () => {
    sqsForm().get('enabled').setValue(true);
    sqsForm().get('accessKeyId').setValue('');
    expect(sqsForm().invalid).toBe(true);
    component.testSqsConnection();
    expect(adminServiceSpy.testSqsConnection).not.toHaveBeenCalled();
  });

  it('should call AdminService.testSqsConnection and surface a success notification', () => {
    adminServiceSpy.testSqsConnection.and.returnValue(of({success: true}) as any);
    sqsForm().get('enabled').setValue(true);
    sqsForm().get('accessKeyId').setValue('AKIA...');
    sqsForm().get('secretAccessKey').setValue('secret');
    sqsForm().get('queueName').setValue('my-queue');
    fixture.detectChanges();

    expect(sqsForm().valid).toBe(true);
    component.testSqsConnection();
    expect(adminServiceSpy.testSqsConnection).toHaveBeenCalled();
    expect(component.testingSqsConnection).toBe(false);
  });

});
