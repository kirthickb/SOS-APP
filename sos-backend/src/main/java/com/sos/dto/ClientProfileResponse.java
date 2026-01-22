package com.sos.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientProfileResponse {
    private Long id;
    private Integer age;
    private String gender;
    private String bloodGroup;
    private String address;
    private String city;
    private String state;
    private String relativeName;
    private String relativePhone;
    private String medicalNotes;
}
