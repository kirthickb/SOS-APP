package com.sos.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriverProfileResponse {
    private Long id;
    private String vehicleNumber;
    private String serviceCity;
    private Boolean isAvailable;
    private Double currentLatitude;
    private Double currentLongitude;
}
