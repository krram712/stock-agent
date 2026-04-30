package com.axiom.user.repository;

import com.axiom.user.model.Script;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScriptRepository extends JpaRepository<Script, UUID> {
    List<Script> findByActiveTrue();
    List<Script> findByCategoryAndActiveTrue(String category);
    boolean existsByNameAndVersion(String name, String version);
    Optional<Script> findByNameAndVersion(String name, String version);
}