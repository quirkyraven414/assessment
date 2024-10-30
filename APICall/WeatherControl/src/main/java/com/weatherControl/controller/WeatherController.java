package com.weatherControl.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.weatherControl.serivce.WeatherService;

@RestController
public class WeatherController {
	
	private final WeatherService weatherService;

    public WeatherController(WeatherService weatherService) {
        this.weatherService = weatherService;
    }

    @GetMapping("/weather")
    public String getWeather(@RequestParam String place) {
        weatherService.getWeather(place);
        return "Weather request queued for place: " + place;
    }

}
