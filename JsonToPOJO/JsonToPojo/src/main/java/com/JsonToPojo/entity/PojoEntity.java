package com.JsonToPojo.entity;

import java.math.BigDecimal;
import java.math.BigInteger;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class PojoEntity {
	
	private String prodName;
	
	private BigDecimal prodPrice;
	
	private BigInteger prodId;
		
	private BigDecimal prodWeight;
	
}
