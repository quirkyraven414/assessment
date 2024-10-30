package com.weatherControl.limiter;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import com.weatherControl.request.WeatherRequest;

public class LeakyBucket {
	
	private final int maxCallsPerMinute = 15; // Defining before because i know it is 15( the cap)
    private final BlockingQueue<WeatherRequest> queue;
    private final AtomicInteger callsMade = new AtomicInteger(0); // Atomic integer for thread-safe counting
    private final ScheduledExecutorService scheduler;
    
    public LeakyBucket() {
        this.queue = new ArrayBlockingQueue<>(100); 
        this.scheduler = Executors.newScheduledThreadPool(5); // Thread pool of 5

        // Schedule the drainBucket method to run every 4 seconds
        scheduler.scheduleAtFixedRate(this::drainBucket, 0, 4, TimeUnit.SECONDS);
    }
    
    private void drainBucket() {
    	
        if (callsMade.get() < maxCallsPerMinute) {
            WeatherRequest request = queue.poll(); // Retrieve and remove the head of the queue
            
            if (request != null) {
                // Create a new thread to handle the API call
                scheduler.submit(() -> {
                    request.getService().makeApiCall(request.getplace());
                    callsMade.incrementAndGet(); // Increment the count atomically
                });
            }
            
	        } else {
	            resetCallCount();
	        }
        
    }

    private void resetCallCount() {
        callsMade.set(0);;
    }
    
    public void queueApiCall(WeatherRequest request) {
        try {
            queue.put(request); // Blocks if the queue is full
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Failed to queue API call: " + e.getMessage());
        }
    }
}