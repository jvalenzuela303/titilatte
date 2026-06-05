package com.minimarket.modules.products.controller;

import com.minimarket.modules.products.domain.Tax;
import com.minimarket.modules.products.repository.TaxRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/taxes")
@RequiredArgsConstructor
@Tag(name = "Taxes", description = "Tax catalog (read-only)")
public class TaxController {

    private final TaxRepository taxRepository;

    @GetMapping
    @Operation(summary = "List all active taxes")
    public ResponseEntity<List<Tax>> findAll() {
        return ResponseEntity.ok(
                taxRepository.findAll().stream()
                        .filter(Tax::isActive)
                        .toList()
        );
    }
}
