export const documents = [
  {
    source: 'nodejs-streams.txt',
    content: `Node.js streams are objects that let you read data from a source or write data to a destination in a continuous fashion. There are four types of streams: Readable, Writable, Duplex, and Transform. Streams are useful for handling large amounts of data efficiently without loading everything into memory at once.`
  },
  {
    source: 'express-middleware.txt',
    content: `Express middleware functions are functions that have access to the request object, response object, and the next middleware function. Middleware can execute code, modify req and res, end the request-response cycle, or call next(). Error-handling middleware takes four arguments: err, req, res, next.`
  },
  {
    source: 'postgres-indexes.txt',
    content: `A database index is a data structure that improves the speed of data retrieval. Without an index, Postgres must scan every row in a table to find matching records. B-tree indexes work well for equality and range queries. For vector similarity search, you need specialized index types like HNSW or IVFFlat.`
  },
  {
    source: 'simple-ai.txt',
    content: `Artificial intelligence (AI) is a branch of computer science that creates systems capable of performing complex tasks that typically require human intelligence, such as reasoning, learning from experience, solving problems, and understanding language. Instead of being explicitly programmed for every action, AI can analyze data to identify patterns and make decisions independently. 
            IBM
            IBM
            +3
            Key Usage Examples of AI
            Virtual Assistants: Tools like Siri, Alexa, and Google Assistant, which understand spoken language and respond to queries.
            Recommendation Algorithms: Systems used by Netflix, YouTube, and Amazon to recommend shows or products tailored to your preferences.
            Content Generation: Chatbots like ChatGPT or Claude that create text, essays, and code, acting as conversational partners.
            Computer Vision: Technology that enables facial recognition on phones, medical image analysis, and object detection in autonomous vehicles.
            Digital Navigation: GPS services like Google Maps that suggest the fastest routes by analyzing real-time traffic data. 
            IBM
            IBM
            +4
            Synonyms and Related Terms
            Machine Learning (ML): A specific type of AI where computers learn from data without being explicitly programmed.
            Deep Learning: A more specialized, advanced form of machine learning inspired by the human brain's neural networks.
            Algorithms: The set of rules and calculations AI uses to process data.
            Intelligent Systems: Another term for software or hardware that exhibits human-like cognitive abilities.`
  },
  {
    source: 'Philippine-economy.txt',
    content: `The economy of the Philippines is an emerging market, and considered as a newly industrialized country in the Asia-Pacific region.[29] In 2026, the Philippine economy is estimated to be at ₱29.9 trillion ($533.92 billion), making it the world's 32nd largest by nominal GDP and 13th largest in Asia according to the International Monetary Fund.

The Philippine economy is a service-oriented economy, with relatively more modest contributions from the manufacturing and agriculture sectors. It has experienced significant economic growth and transformation in the past, posting one of the highest GDP growth rates in Asia. With an average annual growth rate of around 6 percent since 2010, the country has emerged as one of the fastest-growing economies in the world.[30] The Philippines is a founding member of the United Nations, Association of Southeast Asian Nations, Asia-Pacific Economic Cooperation, East Asia Summit and the World Trade Organization.[31] The Asian Development Bank (ADB) is headquartered in the Ortigas Center located in the city of Mandaluyong, Metro Manila.

The country's primary exports include semiconductors and electronic products, transport equipment, garments, chemical products, copper, nickel, abaca, coconut oil, and fruits. Its major trading partners include Japan, China, the United States, Singapore, South Korea, the Netherlands, Hong Kong, Germany, Taiwan, and Thailand. In 2017, the Philippine economy was projected to become the 9th largest in Asia and 19th largest in the world by 2050.[32] By 2035, the Filipino economy is predicted to be the 22nd largest in the world.[33]

The Philippines has been named as one of the Tiger Cub Economies, alongside Indonesia, Malaysia, Vietnam, and Thailand. However, major problems remain, mainly related to alleviating the wide income and growth disparities between the country's different regions and socioeconomic classes, reducing corruption, and investing in the infrastructure necessary to ensure future growth. In 2024, the World Economic Forum chief Børge Brende said that "there is a real opportunity for this country to become a $2-trillion economy."[34]

The Philippines exhibits one of the highest economic densities in Southeast Asia, characterized by a high concentration of economic output relative to its land area. As of 2024–2025, the Philippines ranks third among ASEAN nations in GDP Density (Nominal GDP per square kilometer), trailing only the city-state of Singapore and the resource-rich sultanate of Brunei.[35] This is so, because there is such large economic activity that is happening on such low amount of land area that's scattered amongst a fragmented archipelagic geography. This is expressed in the concept called GDP density.[36][37]

In 2025, the Philippines enacted Republic Act No. 12252, amending the Investors’ Lease Act to allow foreign investors to lease private land for up to 99 years, up from the previous limit of 75 years (50 + 25 extension). This reform aims to enhance the country's competitiveness in attracting long-term foreign direct investment by offering greater leasehold security for commercial and industrial projects.[38] A project called the "Luzon Economic Corridor" is on the works, which will further develop the Philippine economy.[39] It is the first country in the world to put its entire national budget under blockchain technology.`
  },
  // Add more as you like — richer data = more interesting search results
];