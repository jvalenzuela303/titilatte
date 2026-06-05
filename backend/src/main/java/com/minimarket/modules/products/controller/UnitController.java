package com.minimarket.modules.products.controller;

import com.minimarket.modules.products.domain.Unit;
import com.minimarket.modules.products.repository.UnitRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/units")
@RequiredArgsConstructor
@Tag(name = "Units", description = "Unit of measure catalog (read-only)")
public class UnitController {

    private final UnitRepository unitRepository;

    @GetMapping
    @Operation(summary = "List all units of measure")
    public ResponseEntity<List<Unit>> findAll() {
        return ResponseEntity.ok(unitRepository.findAll());
    }
}
