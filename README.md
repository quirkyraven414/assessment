The project contains 2 branch - question3 and question5

# Question 3
This project allows you to easily convert a valid JSON string into a Java object or Map. It ensures that large numbers and decimal values are handled accurately, so you don’t have to worry about losing precision.

- Handles Large Numbers: Supports very big integers and precise decimal values.
- Simple Conversion: Uses Jackson's ObjectMapper to turn JSON strings into Java objects.
- Easy to Use: You can define a Java class to match the structure of your JSON data.
- The utility can convert any valid string even without the Pojo can create a Map object for any String

# Question 5

API Rate Limiting encompasses various techniques, each tailored to specific use cases. In this implementation, I focused on a Weather API call that requires fixed call limits. To effectively manage the rate of requests, I employed the Leaky Bucket Algorithm, as it aligns well with the need for consistent call rates while accommodating bursts of traffic.
