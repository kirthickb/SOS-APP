package com.sos.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "client_profiles")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClientProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private Integer age;

    private String gender;

    @Column(name = "blood_group")
    private String bloodGroup;

    private String address;

    private String city;

    private String state;

    @Column(name = "relative_name")
    private String relativeName;

    @Column(name = "relative_phone")
    private String relativePhone;

    @Column(name = "medical_notes", columnDefinition = "TEXT")
    private String medicalNotes;
}
