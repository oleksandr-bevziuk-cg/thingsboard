// SPDX-FileCopyrightText: Copyright The ThingsBoard Authors
// SPDX-License-Identifier: Apache-2.0
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { GeneralSettingsComponent } from './general-settings.component';
import { AdminService } from '@core/http/admin.service';
import { SqsQueueType } from '@shared/models/settings.models';

describe('GeneralSettingsComponent (SQS form)', () => {
  let component: GeneralSettingsComponent;
  let adminServiceSpy: jasmine.SpyObj<AdminService>;

  beforeEach(() => {
    adminServiceSpy = jasmine.createSpyObj('AdminService', ['getAdminSettings', 'saveAdminSettings', 'testSqsConnection']);
    adminServiceSpy.getAdminSettings.and.returnValue(of({
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
          secretAccessKeySet: false,
          queueType: SqsQueueType.STANDARD
        }
      }
    } as any));
    adminServiceSpy.saveAdminSettings.and.returnValue(of({} as any));
    adminServiceSpy.testSqsConnection.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, TranslateModule.forRoot()],
      declarations: [GeneralSettingsComponent],
      providers: [
        provideMockStore({ initialState: { auth: { authUser: { authority: 'SYS_ADMIN' } } } }),
        { provide: AdminService, useValue: adminServiceSpy },
      ]
    }).overrideComponent(GeneralSettingsComponent, {
      set: { templateUrl: undefined, template: '<div></div>' }
    });

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('builds the sqs form group with correct defaults and validators', () => {
    const sqsGroup = component.deviceConnectivitySettingsForm.get('sqs');
    expect(sqsGroup).toBeTruthy();
    expect(sqsGroup.get('region').value).toBe('us-east-1');
    expect(sqsGroup.get('queueType').value).toBe(SqsQueueType.STANDARD);
    expect(sqsGroup.get('region').disabled).toBeTrue();
    expect(sqsGroup.get('accessKeyId').disabled).toBeTrue();
  });

  it('enables sqs child controls when enabled toggled on', () => {
    const sqsGroup = component.deviceConnectivitySettingsForm.get('sqs');
    sqsGroup.get('enabled').setValue(true);
    expect(sqsGroup.get('region').enabled).toBeTrue();
    expect(sqsGroup.get('accessKeyId').enabled).toBeTrue();
    expect(sqsGroup.get('messageGroupId').disabled).toBeTrue();
  });

  it('enables messageGroupId and useContentBasedDeduplication only for FIFO queue type', () => {
    const sqsGroup = component.deviceConnectivitySettingsForm.get('sqs');
    sqsGroup.get('enabled').setValue(true);
    sqsGroup.get('queueType').setValue(SqsQueueType.FIFO);
    expect(sqsGroup.get('messageGroupId').enabled).toBeTrue();
    expect(sqsGroup.get('useContentBasedDeduplication').enabled).toBeTrue();

    sqsGroup.get('queueType').setValue(SqsQueueType.STANDARD);
    expect(sqsGroup.get('messageGroupId').disabled).toBeTrue();
    expect(sqsGroup.get('messageGroupId').value).toBe('');
    expect(sqsGroup.get('useContentBasedDeduplication').disabled).toBeTrue();
    expect(sqsGroup.get('useContentBasedDeduplication').value).toBeFalse();
  });

  it('requires queueName or queueUrl when enabled', () => {
    const sqsGroup = component.deviceConnectivitySettingsForm.get('sqs');
    sqsGroup.get('enabled').setValue(true);
    expect(sqsGroup.hasError('queueIdentifierRequired')).toBeTrue();
    sqsGroup.get('queueName').setValue('my-queue');
    expect(sqsGroup.hasError('queueIdentifierRequired')).toBeFalse();
  });

  it('validates the numeric bounds on advanced fields', () => {
    const advanced = component.deviceConnectivitySettingsForm.get('sqs.advanced');
    advanced.get('pollingWaitTimeSeconds').setValue(21);
    expect(advanced.get('pollingWaitTimeSeconds').hasError('max')).toBeTrue();
    advanced.get('maxMessagesPerPoll').setValue(0);
    expect(advanced.get('maxMessagesPerPoll').hasError('min')).toBeTrue();
    advanced.get('messageRetentionPeriod').setValue(30);
    expect(advanced.get('messageRetentionPeriod').hasError('min')).toBeTrue();
  });

  it('omits secretAccessKey from the save payload when untouched, includes it when dirtied', () => {
    const sqsGroup = component.deviceConnectivitySettingsForm.get('sqs');
    sqsGroup.get('enabled').setValue(true);
    sqsGroup.get('queueName').setValue('my-queue');
    sqsGroup.get('region').setValue('us-east-1');
    sqsGroup.get('accessKeyId').setValue('AKIA...');

    component.saveDeviceConnectivitySettings();
    let payload = adminServiceSpy.saveAdminSettings.calls.mostRecent().args[0].jsonValue;
    expect(payload.sqs.secretAccessKey).toBeUndefined();

    sqsGroup.get('secretAccessKey').setValue('super-secret');
    sqsGroup.get('secretAccessKey').markAsDirty();
    component.saveDeviceConnectivitySettings();
    payload = adminServiceSpy.saveAdminSettings.calls.mostRecent().args[0].jsonValue;
    expect(payload.sqs.secretAccessKey).toBe('super-secret');
  });

  it('calls testSqsConnection and toggles the loading flag', () => {
    const sqsGroup = component.deviceConnectivitySettingsForm.get('sqs');
    sqsGroup.get('enabled').setValue(true);
    sqsGroup.get('queueName').setValue('my-queue');
    sqsGroup.get('accessKeyId').setValue('AKIA...');

    const states: boolean[] = [];
    component.isTestingSqsConnection$.subscribe(v => states.push(v));

    component.testSqsConnection();

    expect(adminServiceSpy.testSqsConnection).toHaveBeenCalled();
    expect(states[states.length - 1]).toBeFalse();
  });
});
