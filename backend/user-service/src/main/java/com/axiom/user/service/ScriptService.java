package com.axiom.user.service;

import com.axiom.user.model.Script;
import com.axiom.user.repository.ScriptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ScriptService {

    private final ScriptRepository repo;

    public List<Script> getAll()                        { return repo.findByActiveTrue(); }
    public List<Script> getByCategory(String cat)       { return repo.findByCategoryAndActiveTrue(cat.toUpperCase()); }
    public Optional<Script> getById(UUID id)            { return repo.findById(id); }

    public Script create(Script s)                      { return repo.save(s); }

    public Script update(UUID id, Script patch) {
        Script existing = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Script not found: " + id));
        existing.setName(patch.getName());
        existing.setVersion(patch.getVersion());
        existing.setDescription(patch.getDescription());
        existing.setCategory(patch.getCategory());
        existing.setLanguage(patch.getLanguage());
        existing.setContent(patch.getContent());
        existing.setActive(patch.isActive());
        return repo.save(existing);
    }

    public void delete(UUID id) {
        repo.findById(id).ifPresent(s -> { s.setActive(false); repo.save(s); });
    }

    public boolean existsByNameVersion(String name, String version) {
        return repo.existsByNameAndVersion(name, version);
    }
}