package com.minimarket.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
@Slf4j
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();

        // products-catalog: TTL 5 min, max 5000 entries
        manager.registerCustomCache("products-catalog",
                Caffeine.newBuilder()
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .maximumSize(5_000)
                        .recordStats()
                        .build());

        // dashboard-kpis: TTL 15s (hot intraday data)
        manager.registerCustomCache("dashboard-kpis",
                Caffeine.newBuilder()
                        .expireAfterWrite(15, TimeUnit.SECONDS)
                        .maximumSize(50)
                        .recordStats()
                        .build());

        // dashboard-history: TTL 1h (past days don't change)
        manager.registerCustomCache("dashboard-history",
                Caffeine.newBuilder()
                        .expireAfterWrite(1, TimeUnit.HOURS)
                        .maximumSize(200)
                        .recordStats()
                        .build());

        log.info("Caffeine CacheManager configured: products-catalog(5m/5000), dashboard-kpis(15s/50), dashboard-history(1h/200)");
        return manager;
    }
}
