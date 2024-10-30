package com.weatherControl.request;

import com.weatherControl.serivce.WeatherService;

public class WeatherRequest {
	
	private final String place;
    private final WeatherService service;

    public WeatherRequest(String place, WeatherService service) {
        this.place = place;
        this.service = service;
    }

    public String getplace() {
        return place;
    }

    public WeatherService getService() {
        return service;
    }

}
