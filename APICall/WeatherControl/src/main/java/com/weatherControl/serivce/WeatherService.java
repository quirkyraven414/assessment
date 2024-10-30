package com.weatherControl.serivce;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.weatherControl.limiter.LeakyBucket;
import com.weatherControl.request.WeatherRequest;



@Service
public class WeatherService {
	
	private final String apiUrl = "https://api.weather.com/v1/your-endpoint"; 
	private final LeakyBucket leakyBucket;

    public WeatherService(LeakyBucket leakyBucket) {
        this.leakyBucket = leakyBucket;
    }
	
	public void getWeather(String place) {
			    
        WeatherRequest request = new WeatherRequest(place, this);
        leakyBucket.queueApiCall(request);
    }
	
	public void makeApiCall(String place) {
        RestTemplate restTemplate = new RestTemplate();
        
        // Doing the actual API call
        String response = restTemplate.getForObject(apiUrl + "?place=" + place, String.class);
        
        System.out.println("Weather response for place " + place + ": " + response);
    }
	

}