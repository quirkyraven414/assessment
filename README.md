# Question 5

This question is solved by using Leaky Bucket Algorithm

- The rate can be constantly controlled and there would be a cap on the Api calls
- So, the calls cannot go more than the safe limit
- Even the calls are more than 20, it is made sure that it wont be executed
- Instead it is added into a queue and only after the time, it would be executed

  As explained in the readme file, there are different logics to implement this but I used Leaky bucket

- I considered the example of a Weather call Api for a place (input is only place)
- Weather calls are usually in limited number so they wont come in large number
- So they can be handled properly using this
- In extreme cases, typhoon and all to ensure proper control of the traffic this approach can be used 
