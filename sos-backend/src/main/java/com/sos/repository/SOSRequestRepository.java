package com.sos.repository;

import com.sos.entity.SOSRequest;
import com.sos.entity.SOSStatus;
import com.sos.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SOSRequestRepository extends JpaRepository<SOSRequest, Long> {

    @Query("SELECT s FROM SOSRequest s WHERE s.status = :status " +
           "AND (6371 * acos(cos(radians(:lat)) * cos(radians(s.latitude)) * " +
           "cos(radians(s.longitude) - radians(:lng)) + " +
           "sin(radians(:lat)) * sin(radians(s.latitude)))) <= :radius")
    List<SOSRequest> findNearbySOS(
            @Param("lat") Double latitude,
            @Param("lng") Double longitude,
            @Param("radius") Double radiusInKm,
            @Param("status") SOSStatus status
    );

    List<SOSRequest> findByAcceptedDriverAndStatus(User acceptedDriver, SOSStatus status);
    
    // Find SOS requests by driver with multiple statuses (for real-time location tracking)
    List<SOSRequest> findByAcceptedDriverAndStatusIn(User acceptedDriver, List<SOSStatus> statuses);
}
