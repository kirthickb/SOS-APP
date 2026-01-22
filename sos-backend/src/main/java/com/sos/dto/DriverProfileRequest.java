package com.sos.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DriverProfileRequest {
    @NotBlank(message = "Vehicle number is required")
    private String vehicleNumber;
    
    @NotBlank(message = "Service city is required")
    private String serviceCity;
}
