// SPDX-FileCopyrightText: Copyright The ThingsBoard Authors
// SPDX-License-Identifier: Apache-2.0
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GeneralSettingsComponent } from './general-settings.component';
import { AdminService } from '@core/http/admin.service';
import { Store } from '@ngrx/store';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import {
  AdminSettings,
  DeviceConnectivitySettings,
  GeneralSettings,
  SqsConnectivitySettings
} from '@shared/models/settings.models';

describe('GeneralSettingsComponent', () => {
  let component: GeneralSettingsComponent;
  let fixture: ComponentFixture<GeneralSettingsComponent>;
  let adminService: jasmine.SpyObj<AdminService>;
  let store: jasmine.SpyObj<Store>;

  const mockGeneralSettings: AdminSettings<GeneralSettings> = {
    key: 'general',
    jsonValue: {
      baseUrl: 'http://localhost:8080'
    }
  };

  const mockDeviceConnectivitySettings: AdminSettings<DeviceConnectivitySettings> = {
    key: 'connectivity',
    jsonValue: {
      http: { enabled: false, host: '', port: 80 },
      https: { enabled: false, host: '', port: 443 },
      mqtt: { enabled: false, host: '', port: 1883 },
      mqtts: { enabled: false, host: '', port: 8883 },
      coap: { enabled: false, host: '', port: 5683 },
      coaps: { enabled: false, host: '', port: 5684 }
    }
  };

  const mockSqsSettings: AdminSettings<SqsConnectivitySettings> = {
    key: 'connectivitySqs',
    jsonValue: {
      enabled: false,
      region: 'us-east-1',
      accessKeyId: '',
      secretAccessKey: '',
      queueName: '',
      queueUrl: '',
      queueType: 'STANDARD',
      messageRetentionPeriod: 345600
    }
  };

  beforeEach(async () => {
    const adminServiceSpy = jasmine.createSpyObj('AdminService', [
      'getAdminSettings',
      'saveAdminSettings',
      'sendTestSqsConnection'
    ]);
    const storeSpy = jasmine.createSpyObj('Store', ['dispatch']);

    adminServiceSpy.getAdminSettings.and.callFake((key: string) => {
      if (key === 'general') {
        return of(mockGeneralSettings);
      } else if (key === 'connectivity') {
        return of(mockDeviceConnectivitySettings);
      } else if (key === 'connectivitySqs') {
        return of(mockSqsSettings);
      }
      return of(null);
    });

    await TestBed.configureTestingModule({
      declarations: [ GeneralSettingsComponent ],
      providers: [
        FormBuilder,
        { provide: AdminService, useValue: adminServiceSpy },
        { provide: Store, useValue: storeSpy }
      ]
    })
    .compileComponents();

    adminService = TestBed.inject(AdminService) as jasmine.SpyObj<AdminService>;
    store = TestBed.inject(Store) as jasmine.SpyObj<Store>;
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GeneralSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('SQS Settings Form', () => {
    it('should build SQS settings form with correct controls', () => {
      expect(component.sqsSettingsForm).toBeDefined();
      expect(component.sqsSettingsForm.get('enabled')).toBeDefined();
      expect(component.sqsSettingsForm.get('region')).toBeDefined();
      expect(component.sqsSettingsForm.get('accessKeyId')).toBeDefined();
      expect(component.sqsSettingsForm.get('secretAccessKey')).toBeDefined();
      expect(component.sqsSettingsForm.get('sessionToken')).toBeDefined();
      expect(component.sqsSettingsForm.get('queueName')).toBeDefined();
      expect(component.sqsSettingsForm.get('queueUrl')).toBeDefined();
      expect(component.sqsSettingsForm.get('queueType')).toBeDefined();
      expect(component.sqsSettingsForm.get('messageGroupId')).toBeDefined();
      expect(component.sqsSettingsForm.get('useContentBasedDeduplication')).toBeDefined();
      expect(component.sqsSettingsForm.get('messageRetentionPeriod')).toBeDefined();
      expect(component.sqsSettingsForm.get('endpointOverride')).toBeDefined();
      expect(component.sqsSettingsForm.get('visibilityTimeout')).toBeDefined();
      expect(component.sqsSettingsForm.get('pollingWaitTimeSeconds')).toBeDefined();
      expect(component.sqsSettingsForm.get('maxMessagesPerPoll')).toBeDefined();
      expect(component.sqsSettingsForm.get('connectionTimeout')).toBeDefined();
      expect(component.sqsSettingsForm.get('retryAttempts')).toBeDefined();
    });

    it('should set default values for SQS settings form', () => {
      expect(component.sqsSettingsForm.get('enabled').value).toBe(false);
      expect(component.sqsSettingsForm.get('region').value).toBe('us-east-1');
      expect(component.sqsSettingsForm.get('queueType').value).toBe('STANDARD');
      expect(component.sqsSettingsForm.get('messageRetentionPeriod').value).toBe(345600);
    });

    it('should disable all fields when enabled is false', () => {
      component.sqsSettingsForm.get('enabled').setValue(false);
      expect(component.sqsSettingsForm.get('region').disabled).toBe(true);
      expect(component.sqsSettingsForm.get('accessKeyId').disabled).toBe(true);
      expect(component.sqsSettingsForm.get('secretAccessKey').disabled).toBe(true);
    });

    it('should enable all fields when enabled is true', (done) => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      // Wait for valueChanges subscription to process
      setTimeout(() => {
        expect(component.sqsSettingsForm.get('region').disabled).toBe(false);
        expect(component.sqsSettingsForm.get('accessKeyId').disabled).toBe(false);
        done();
      }, 100);
    });

    it('should validate required field for region when enabled', () => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('region').setValue('');
      expect(component.sqsSettingsForm.get('region').hasError('required')).toBe(true);
    });

    it('should validate region format', () => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('region').setValue('invalid-region');
      expect(component.sqsSettingsForm.get('region').hasError('pattern')).toBe(true);

      component.sqsSettingsForm.get('region').setValue('us-east-1');
      expect(component.sqsSettingsForm.get('region').hasError('pattern')).toBe(false);
    });

    it('should enable FIFO-specific fields when queue type is FIFO', (done) => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('queueType').setValue('FIFO');
      // Wait for valueChanges subscription to process
      setTimeout(() => {
        expect(component.sqsSettingsForm.get('messageGroupId').disabled).toBe(false);
        expect(component.sqsSettingsForm.get('useContentBasedDeduplication').disabled).toBe(false);
        done();
      }, 100);
    });

    it('should disable FIFO-specific fields when queue type is STANDARD', (done) => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('queueType').setValue('FIFO');
      // Wait for change
      setTimeout(() => {
        component.sqsSettingsForm.get('queueType').setValue('STANDARD');
        // Wait for valueChanges subscription to process
        setTimeout(() => {
          expect(component.sqsSettingsForm.get('messageGroupId').disabled).toBe(true);
          expect(component.sqsSettingsForm.get('useContentBasedDeduplication').disabled).toBe(true);
          done();
        }, 100);
      }, 100);
    });

    it('should validate that at least one of queue name or URL is provided', () => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('queueName').setValue('');
      component.sqsSettingsForm.get('queueUrl').setValue('');
      expect(component.sqsSettingsForm.hasError('queueIdentifierRequired')).toBe(true);

      component.sqsSettingsForm.get('queueName').setValue('my-queue');
      expect(component.sqsSettingsForm.hasError('queueIdentifierRequired')).toBe(false);
    });

    it('should validate message retention period range', () => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('messageRetentionPeriod').setValue(30);
      expect(component.sqsSettingsForm.get('messageRetentionPeriod').hasError('min')).toBe(true);

      component.sqsSettingsForm.get('messageRetentionPeriod').setValue(60);
      expect(component.sqsSettingsForm.get('messageRetentionPeriod').hasError('min')).toBe(false);

      component.sqsSettingsForm.get('messageRetentionPeriod').setValue(1209601);
      expect(component.sqsSettingsForm.get('messageRetentionPeriod').hasError('max')).toBe(true);
    });

    it('should validate visibility timeout range', () => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('visibilityTimeout').setValue(43201);
      expect(component.sqsSettingsForm.get('visibilityTimeout').hasError('max')).toBe(true);

      component.sqsSettingsForm.get('visibilityTimeout').setValue(43200);
      expect(component.sqsSettingsForm.get('visibilityTimeout').hasError('max')).toBe(false);
    });

    it('should validate polling wait time seconds range', () => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('pollingWaitTimeSeconds').setValue(21);
      expect(component.sqsSettingsForm.get('pollingWaitTimeSeconds').hasError('max')).toBe(true);

      component.sqsSettingsForm.get('pollingWaitTimeSeconds').setValue(20);
      expect(component.sqsSettingsForm.get('pollingWaitTimeSeconds').hasError('max')).toBe(false);
    });

    it('should validate max messages per poll range', () => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('maxMessagesPerPoll').setValue(0);
      expect(component.sqsSettingsForm.get('maxMessagesPerPoll').hasError('min')).toBe(true);

      component.sqsSettingsForm.get('maxMessagesPerPoll').setValue(11);
      expect(component.sqsSettingsForm.get('maxMessagesPerPoll').hasError('max')).toBe(true);

      component.sqsSettingsForm.get('maxMessagesPerPoll').setValue(5);
      expect(component.sqsSettingsForm.get('maxMessagesPerPoll').hasError('max')).toBe(false);
    });

    it('should validate retry attempts range', () => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('retryAttempts').setValue(11);
      expect(component.sqsSettingsForm.get('retryAttempts').hasError('max')).toBe(true);

      component.sqsSettingsForm.get('retryAttempts').setValue(10);
      expect(component.sqsSettingsForm.get('retryAttempts').hasError('max')).toBe(false);
    });
  });

  describe('SQS Settings Methods', () => {
    it('should save SQS settings', () => {
      adminService.saveAdminSettings.and.returnValue(of(mockSqsSettings));
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('region').setValue('us-west-2');
      component.sqsSettingsForm.get('accessKeyId').setValue('test-key');
      component.sqsSettingsForm.get('queueName').setValue('test-queue');

      component.saveSqsSettings();

      expect(adminService.saveAdminSettings).toHaveBeenCalled();
    });

    it('should discard SQS settings changes', () => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('region').setValue('us-west-2');

      component.discardSqsSettings();

      expect(component.sqsSettingsForm.get('region').value).toBe('us-east-1');
      expect(component.sqsSettingsForm.get('enabled').value).toBe(false);
    });

    it('should not send secret key if pristine', () => {
      component.sqsSettingsForm.get('secretAccessKey').markAsPristine();
      const testRequest = (component as any).buildTestSqsConnectionRequest();
      expect(testRequest.secretAccessKey).toBeDefined();
    });

    it('should test SQS connection', () => {
      adminService.sendTestSqsConnection.and.returnValue(of(void 0));
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('region').setValue('us-east-1');
      component.sqsSettingsForm.get('accessKeyId').setValue('test-key');
      component.sqsSettingsForm.get('secretAccessKey').setValue('test-secret');
      component.sqsSettingsForm.get('queueName').setValue('test-queue');

      component.testSqsConnection();

      expect(adminService.sendTestSqsConnection).toHaveBeenCalled();
      expect(store.dispatch).toHaveBeenCalled();
    });

    it('should not test SQS connection if form is invalid', () => {
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('accessKeyId').setValue('');

      component.testSqsConnection();

      expect(adminService.sendTestSqsConnection).not.toHaveBeenCalled();
    });

    it('should set isTestingSqsConnection flag during test', (done) => {
      adminService.sendTestSqsConnection.and.returnValue(of(void 0));
      component.sqsSettingsForm.get('enabled').setValue(true);
      component.sqsSettingsForm.get('region').setValue('us-east-1');
      component.sqsSettingsForm.get('accessKeyId').setValue('test-key');
      component.sqsSettingsForm.get('secretAccessKey').setValue('test-secret');
      component.sqsSettingsForm.get('queueName').setValue('test-queue');

      component.testSqsConnection();
      expect(component.isTestingSqsConnection).toBe(true);

      setTimeout(() => {
        expect(component.isTestingSqsConnection).toBe(false);
        done();
      }, 100);
    });
  });

  describe('confirmForm', () => {
    it('should return general settings form if it is dirty', () => {
      component.generalSettings.markAsDirty();
      const form = component.confirmForm();
      expect(form).toBe(component.generalSettings);
    });

    it('should return device connectivity form if general is clean and device is dirty', () => {
      component.generalSettings.markAsPristine();
      component.deviceConnectivitySettingsForm.markAsDirty();
      const form = component.confirmForm();
      expect(form).toBe(component.deviceConnectivitySettingsForm);
    });

    it('should return SQS form if general and device are clean and SQS is dirty', () => {
      component.generalSettings.markAsPristine();
      component.deviceConnectivitySettingsForm.markAsPristine();
      component.sqsSettingsForm.markAsDirty();
      const form = component.confirmForm();
      expect(form).toBe(component.sqsSettingsForm);
    });
  });
});
