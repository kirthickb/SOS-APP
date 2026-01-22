package com.sos.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AvailabilityRequest {
    @NotNull(message = "Availability status is required")
    private Boolean isAvailable;
}
