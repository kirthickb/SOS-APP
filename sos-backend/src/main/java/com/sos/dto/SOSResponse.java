package com.sos.dto;

import com.sos.entity.SOSStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SOSResponse {
    private Long id;
    private String clientName;
    private String clientPhone;
    private Double latitude;
    private Double longitude;
    private SOSStatus status;
    private String acceptedDriverName;
    private String acceptedDriverPhone;
    private Double driverLatitude;
    private Double driverLongitude;
    private LocalDateTime createdAt;
}
