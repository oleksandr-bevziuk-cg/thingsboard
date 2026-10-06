// SPDX-FileCopyrightText: Copyright The ThingsBoard Authors
// SPDX-License-Identifier: Apache-2.0
package org.thingsboard.server.service.sqs;

import com.amazonaws.ClientConfiguration;
import com.amazonaws.auth.AWSCredentials;
import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.services.sqs.AmazonSQS;
import com.amazonaws.services.sqs.AmazonSQSClientBuilder;
import com.amazonaws.services.sqs.model.GetQueueAttributesRequest;
import com.amazonaws.services.sqs.model.GetQueueAttributesResult;
import com.amazonaws.services.sqs.model.QueueAttributeName;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.thingsboard.server.common.data.exception.ThingsboardErrorCode;
import org.thingsboard.server.common.data.exception.ThingsboardException;
import org.thingsboard.server.common.data.sqs.SqsSettings;
import org.thingsboard.server.queue.util.TbCoreComponent;

@Service
@TbCoreComponent
@Slf4j
@RequiredArgsConstructor
public class SqsConnectionTestService {

    public void testConnection(SqsSettings settings) throws ThingsboardException {
        if (!settings.isEnabled()) {
            throw new ThingsboardException("SQS integration is not enabled", ThingsboardErrorCode.BAD_REQUEST_PARAMS);
        }

        if (settings.getSecretAccessKey() == null || settings.getSecretAccessKey().isEmpty()) {
            throw new ThingsboardException("Secret access key is required", ThingsboardErrorCode.BAD_REQUEST_PARAMS);
        }

        AmazonSQS sqsClient = null;
        try {
            sqsClient = createSqsClient(settings);
            testQueueAccess(sqsClient, settings);
        } catch (ThingsboardException e) {
            throw e;
        } catch (Exception e) {
            String message = extractErrorMessage(e);
            log.error("SQS connection test failed: {}", message);
            throw new ThingsboardException("Failed to connect to SQS queue: " + message,
                    ThingsboardErrorCode.GENERAL);
        } finally {
            if (sqsClient != null) {
                try {
                    sqsClient.shutdown();
                } catch (Exception e) {
                    log.debug("Error closing SQS client: {}", e.getMessage());
                }
            }
        }
    }

    private AmazonSQS createSqsClient(SqsSettings settings) throws ThingsboardException {
        try {
            AWSCredentials awsCredentials = new BasicAWSCredentials(
                    settings.getAccessKeyId(),
                    settings.getSecretAccessKey());
            AWSStaticCredentialsProvider credProvider = new AWSStaticCredentialsProvider(awsCredentials);

            int connectionTimeoutMs = settings.getConnectionTimeoutMs() != null ?
                    settings.getConnectionTimeoutMs() : 10000;
            int requestTimeoutMs = settings.getRequestTimeoutMs() != null ?
                    settings.getRequestTimeoutMs() : 5000;
            int maxRetries = settings.getMaxRetries() != null ?
                    settings.getMaxRetries() : 3;

            AmazonSQSClientBuilder builder = AmazonSQSClientBuilder.standard()
                    .withCredentials(credProvider)
                    .withRegion(settings.getRegion())
                    .withClientConfiguration(new ClientConfiguration()
                            .withConnectionTimeout(connectionTimeoutMs)
                            .withRequestTimeout(requestTimeoutMs)
                            .withMaxErrorRetry(maxRetries));

            if (settings.getEndpointOverride() != null && !settings.getEndpointOverride().isEmpty()) {
                builder.withEndpointConfiguration(
                        new com.amazonaws.client.builder.AwsClientBuilder.EndpointConfiguration(
                                settings.getEndpointOverride(),
                                settings.getRegion()));
            }

            return builder.build();
        } catch (IllegalArgumentException e) {
            throw new ThingsboardException("Invalid AWS region or configuration: " + e.getMessage(),
                    ThingsboardErrorCode.BAD_REQUEST_PARAMS);
        } catch (Exception e) {
            throw new ThingsboardException("Failed to create SQS client: " + e.getMessage(),
                    ThingsboardErrorCode.GENERAL);
        }
    }

    private void testQueueAccess(AmazonSQS sqsClient, SqsSettings settings) throws ThingsboardException {
        try {
            GetQueueAttributesRequest request = new GetQueueAttributesRequest()
                    .withQueueUrl(settings.getQueueUrl())
                    .withAttributeNames(QueueAttributeName.QueueArn);

            GetQueueAttributesResult result = sqsClient.getQueueAttributes(request);
            String queueArn = result.getAttributes().get(QueueAttributeName.QueueArn.name());

            log.info("Successfully connected to SQS queue. Queue ARN: {}", queueArn);
        } catch (com.amazonaws.services.sqs.model.QueueDoesNotExistException e) {
            throw new ThingsboardException("SQS queue not found: " + settings.getQueueUrl(),
                    ThingsboardErrorCode.BAD_REQUEST_PARAMS);
        } catch (com.amazonaws.AmazonServiceException e) {
            if (e.getStatusCode() == 403 || e.getErrorCode().equals("AccessDenied")) {
                throw new ThingsboardException("Access denied to SQS queue. Check AWS credentials and permissions.",
                        ThingsboardErrorCode.PERMISSION_DENIED);
            } else if (e.getErrorCode().contains("InvalidAddress")) {
                throw new ThingsboardException("Invalid queue URL or endpoint: " + e.getMessage(),
                        ThingsboardErrorCode.BAD_REQUEST_PARAMS);
            } else {
                throw new ThingsboardException("AWS Service error: " + e.getMessage(),
                        ThingsboardErrorCode.GENERAL);
            }
        } catch (Exception e) {
            throw new ThingsboardException("Failed to verify SQS queue access: " + e.getMessage(),
                    ThingsboardErrorCode.GENERAL);
        }
    }

    private String extractErrorMessage(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isEmpty()) {
            message = e.getClass().getSimpleName();
        }
        // Ensure we don't leak sensitive information
        return message.replaceAll("(?i)secret|(?i)password|(?i)key", "***");
    }
}
