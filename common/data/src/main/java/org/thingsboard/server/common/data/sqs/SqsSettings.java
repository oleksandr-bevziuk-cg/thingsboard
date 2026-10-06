// SPDX-FileCopyrightText: Copyright The ThingsBoard Authors
// SPDX-License-Identifier: Apache-2.0
package org.thingsboard.server.common.data.sqs;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SqsSettings {

    private boolean enabled;
    private String region;
    private String accessKeyId;
    private String secretAccessKey;
    private String queueUrl;
    private String queueName;
    private String queueType; // STANDARD or FIFO
    private String messageGroupId;
    private Boolean contentBasedDeduplication;
    private String endpointOverride;
    private Integer visibilityTimeoutSeconds;
    private Integer pollingWaitTimeSeconds;
    private Integer maxNumberOfMessages;
    private Integer connectionTimeoutMs;
    private Integer requestTimeoutMs;
    private Integer maxRetries;

    @JsonIgnore
    public SqsSettings cloneAndClearSecret() {
        SqsSettings cloned = new SqsSettings();
        cloned.setEnabled(this.enabled);
        cloned.setRegion(this.region);
        cloned.setAccessKeyId(this.accessKeyId);
        cloned.setQueueUrl(this.queueUrl);
        cloned.setQueueName(this.queueName);
        cloned.setQueueType(this.queueType);
        cloned.setMessageGroupId(this.messageGroupId);
        cloned.setContentBasedDeduplication(this.contentBasedDeduplication);
        cloned.setEndpointOverride(this.endpointOverride);
        cloned.setVisibilityTimeoutSeconds(this.visibilityTimeoutSeconds);
        cloned.setPollingWaitTimeSeconds(this.pollingWaitTimeSeconds);
        cloned.setMaxNumberOfMessages(this.maxNumberOfMessages);
        cloned.setConnectionTimeoutMs(this.connectionTimeoutMs);
        cloned.setRequestTimeoutMs(this.requestTimeoutMs);
        cloned.setMaxRetries(this.maxRetries);
        // Intentionally do NOT clone secretAccessKey
        return cloned;
    }
}
