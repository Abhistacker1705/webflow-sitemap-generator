const express = require("express")
const fetch = require("node-fetch")
const cors = require("cors")

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors()) // Enable CORS for all routes
app.use(express.json()) // Parse JSON request bodies

// Endpoint to fetch static pages and collections
app.post("/api/fetch-data", async (req, res) => {
  const { apiKey, siteId } = req.body

  if (!apiKey || !siteId) {
    return res.status(400).json({ error: "API Key and Site ID are required" })
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "accept-version": "2.0.0",
  }

  try {
    // Fetch all static pages in a loop
    let allStaticPages = []
    let offset = 0
    const limit = 100

    while (true) {
      const response = await fetch(
        `https://api.webflow.com/v2/sites/${siteId}/pages?limit=${limit}&offset=${offset}`,
        { headers }
      ).then((res) => res.json())

      if (!response.pages || response.pages.length === 0) break

      allStaticPages = allStaticPages.concat(response.pages)
      offset += limit
    }

    // Fetch collections
    const collectionsResponse = await fetch(
      `https://api.webflow.com/v2/sites/${siteId}/collections`,
      { headers }
    ).then((res) => res.json())

    const collections = collectionsResponse.collections || []

    // Fetch items for each collection
    const collectionItems = {}
    for (const collection of collections) {
      const items = await fetchAllCollectionItems(collection.id, headers)
      collectionItems[collection.slug] = items.map(
        (item) => `/${collection.slug}/${item.fieldData.slug}`
      )
    }

    // Send response
    res.json({
      staticPages: allStaticPages.filter(
        (page) => !page.draft && !page.archived
      ),
      collections,
      collectionItems,
    })
  } catch (error) {
    console.error("Error fetching data:", error)
    res.status(500).json({ error: "Failed to fetch data" })
  }
})

// Function to fetch all items in a collection
async function fetchAllCollectionItems(collectionId, headers) {
  let items = []
  let offset = 0
  const limit = 100

  try {
    while (true) {
      const response = await fetch(
        `https://api.webflow.com/v2/collections/${collectionId}/items?limit=${limit}&offset=${offset}`,
        { headers }
      ).then((res) => res.json())

      if (!response.items || response.items.length === 0) break

      items = items.concat(response.items)
      offset += limit
    }
  } catch (error) {
    console.error("Error fetching collection items:", error)
    throw error
  }
  return items
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
