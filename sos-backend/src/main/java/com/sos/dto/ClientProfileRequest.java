package com.sos.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ClientProfileRequest {
    private Integer age;
    private String gender;
    private String bloodGroup;
    
    @NotBlank(message = "Address is required")
    private String address;
    
    @NotBlank(message = "City is required")
    private String city;
    
    @NotBlank(message = "State is required")
    private String state;
    
    @NotBlank(message = "Relative name is required")
    private String relativeName;
    
    @NotBlank(message = "Relative phone is required")
    private String relativePhone;
    
    private String medicalNotes;
}
