package com.JsonToPojo.Convert;

import java.util.Map;

import com.JsonToPojo.entity.PojoEntity;
import com.fasterxml.jackson.databind.ObjectMapper;

public class JsonConverter {
	
	// Used Biginteger and bigdecimal to make sure the int float values are arbitrary and can
	// support any value beyond the primitive types
	
	public static void main(String[] args) {
		
		// If the string is of this structure - it can be parsed using Object Mapper
		
		String inputJson = "{\"prodId\":1,\"prodName\":\"Laptop\",\"prodPrice\":999.99,\"prodWeight\":2.5}";
		
		// Else string also should be changed so it becomes of this format
		
		ObjectMapper mapper = new ObjectMapper();
		
		// Converting to a Map - here the json can be anything we dont need to know the pojo before hand
		
		try {
			
			Map<String, Object> map = mapper.readValue(inputJson, Map.class);
			
			for (Map.Entry<String, Object> entry : map.entrySet()) {
                System.out.println("Key name: " + entry.getKey() + ", Key Value: " + entry.getValue());
            }
						
		}
		catch(Exception e) {
			System.out.println(e.getMessage());
		}
		
				
		// Converting String to Object - here the Object pojo is to be known before hand
		try {
			
			PojoEntity product = mapper.readValue(inputJson, PojoEntity.class);
						
			// Printing objects different attributes:
			
			System.out.println(product.getProdId());
			System.out.println(product.getProdName());
			System.out.println(product.getProdPrice());
			System.out.println(product.getProdWeight());
			
		}catch(Exception e) {
			System.out.println(e.getMessage());
		}

		
	}
	
	
}
