package com.sos.entity;

public enum SOSStatus {
    PENDING,      // Initial state when client creates SOS
    ACCEPTED,     // Driver accepts the SOS request
    ARRIVED,      // Driver has arrived and picked up patient
    COMPLETED,    // Driver has delivered patient to hospital
    CANCELLED     // SOS was cancelled
}
