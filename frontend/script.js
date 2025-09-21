const BACKEND_BASE_URL = "https://webflow-sitemap-generator.onrender.com" // Update this to your Render backend URL
let collectionItems = {}

function showLoadingModal() {
  const modal = document.getElementById("loadingModal")
  modal.style.display = "flex"
}

function hideLoadingModal() {
  const modal = document.getElementById("loadingModal")
  modal.style.display = "none"
}

function addLanguageConfig() {
  const configsDiv = document.getElementById("languageConfigs")
  const newConfig = document.createElement("div")
  newConfig.className = "language-config"
  newConfig.innerHTML = `
    <input type="text" class="lang-code" placeholder="Language Code (e.g., en)" value="en">
    <input type="text" class="lang-folder" placeholder="Subfolder (e.g., en or leave empty)" value="">
    <button class="btn-remove" onclick="removeLanguageConfig(this)">×</button>
  `
  configsDiv.appendChild(newConfig)
}

function removeLanguageConfig(button) {
  button.parentElement.remove()
}

function getLanguageConfigs() {
  const configs = []
  document.querySelectorAll(".language-config").forEach((config) => {
    const code = config.querySelector(".lang-code").value.trim()
    const folder = config.querySelector(".lang-folder").value.trim()
    if (code) {
      configs.push({ code, folder })
    }
  })
  return configs
}

async function fetchPages() {
  showLoadingModal()
  const apiKey = document.getElementById("apiKey").value.trim()
  const siteId = document.getElementById("siteId").value.trim()

  if (!apiKey || !siteId) {
    hideLoadingModal()
    return alert("Enter API Key and Site ID")
  }

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/fetch-data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ apiKey, siteId }),
    }).then((res) => res.json())

    if (response.error) {
      throw new Error(response.error)
    }
    collectionItems = { ...response.collectionItems }

    // Render static pages
    document.getElementById("staticPages").innerHTML = response.staticPages
      .filter((page) => !page.collectionId || page.draft || page.archived)
      .map(
        (page) => `
          <label>
            <input type="checkbox" class="static" value="${page.publishedPath}" data-lastmod="${page.lastUpdated}">
            ${page.title}
            <input type="number" step="0.1" min="0.1" max="1.0" placeholder="Priority (0.8)" data-priority="${page.publishedPath}" value="0.8">
          </label>`
      )
      .join("")

    // Show collections
    let collectionsHtml = ""
    for (const collection of response.collections) {
      collectionsHtml += `
        <label>
          <input type="checkbox" class="collection" value="${collection.slug}">
          ${collection.displayName} (${
        response.collectionItems[collection.slug].length
      } items)
          <input type="number" step="0.1" min="0.1" max="1.0" placeholder="Priority (0.8)" data-collection-priority="${
            collection.slug
          }" value="0.8">
        </label>`
    }

    document.getElementById("collections").innerHTML = collectionsHtml
  } catch (error) {
    console.error("Error fetching data:", error)
    alert("Failed to fetch data. Please check your API key and site ID.")
  } finally {
    hideLoadingModal()
  }
}

function toggleSelectAll(type) {
  const selectAllCheckbox = document.getElementById(
    `selectAll${type.charAt(0).toUpperCase() + type.slice(1)}`
  )

  if (!selectAllCheckbox) {
    console.error(`"Select All" checkbox for type "${type}" not found.`)
    return
  }

  const checkboxes = document.querySelectorAll(`input.${type}`)
  const selectAll = selectAllCheckbox.checked
  checkboxes.forEach((cb) => (cb.checked = selectAll))
}

function generateSitemap() {
  showLoadingModal()

  // Get the base URL from the input field
  let baseUrl = document.getElementById("baseUrl").value.trim()
  if (!baseUrl) {
    hideLoadingModal()
    return alert("Enter Base URL")
  }

  // Ensure the base URL ends with a slash
  if (!baseUrl.endsWith("/")) {
    baseUrl += "/"
  }

  let urls = []

  // Add Static Pages
  document.querySelectorAll("input.static:checked").forEach((cb) => {
    let priorityInput = document.querySelector(
      `input[data-priority='${cb.value}']`
    )
    let priority = priorityInput?.value
      ? parseFloat(priorityInput.value).toFixed(1)
      : "0.8"
    let lastmod =
      cb.getAttribute("data-lastmod").split("T")[0] ||
      new Date().toISOString().split("T")[0]

    urls.push({ loc: cb.value, lastmod, priority })
  })

  // Add Collection Items
  document.querySelectorAll("input.collection:checked").forEach((cb) => {
    let collectionSlug = cb.value
    let priorityInput = document.querySelector(
      `input[data-collection-priority='${collectionSlug}']`
    )
    let priority = priorityInput?.value
      ? parseFloat(priorityInput.value).toFixed(1)
      : "0.8"

    collectionItems[collectionSlug].forEach((url) => {
      urls.push({
        loc: url,
        lastmod: new Date().toISOString().split("T")[0],
        priority,
      })
    })
  })

  //sort by priority
  urls.sort((a, b) => parseFloat(b.priority) - parseFloat(a.priority))

  // Generate XML Sitemap
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`

  const languageConfigs = getLanguageConfigs()
  if (languageConfigs.length === 0) {
    languageConfigs.push({ code: "en", folder: "" }) // Default to English if no configs
  }

  urls.forEach(({ loc, lastmod, priority }) => {
    languageConfigs.forEach(({ code, folder }) => {
      // Construct the URL based on whether there's a subfolder
      let localizedLoc
      if (folder) {
        // If there's a subfolder, use it
        localizedLoc = `${baseUrl}${folder}${loc === "/" ? "" : loc}`
      } else {
        // If no subfolder, use the base URL directly
        localizedLoc = `${baseUrl}${loc === "/" ? "" : loc.replace(/^\//, "")}`
      }

      xml += `
    <url>
      <loc>${localizedLoc}</loc>
      <lastmod>${lastmod}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>${priority}</priority>`

      // Add hreflang alternates
      if (languageConfigs.length > 1) {
        languageConfigs.forEach(({ code: altCode, folder: altFolder }) => {
          let altHref
          if (altFolder) {
            altHref = `${baseUrl}${altFolder}${loc === "/" ? "" : loc}`
          } else {
            altHref = `${baseUrl}${loc === "/" ? "" : loc.replace(/^\//, "")}`
          }

          xml += `
      <xhtml:link rel="alternate" hreflang="${altCode}" href="${altHref}"/>`
        })
      }
      if (languageConfigs.length > 1) {
        const defaultConfig = languageConfigs[0]
        const defaultHref = defaultConfig.folder
          ? `${baseUrl}${defaultConfig.folder}${loc === "/" ? "" : loc}`
          : `${baseUrl}${loc === "/" ? "" : loc.replace(/^\//, "")}`

        xml += `
      <xhtml:link rel="alternate" hreflang="x-default" href="${defaultHref}"/>
    </url>`
      }
    })
  })

  xml += "\n</urlset>"

  // Display XML in textarea
  let textarea = document.getElementById("sitemapOutput")
  if (!textarea) {
    textarea = document.createElement("textarea")
    textarea.id = "sitemapOutput"
    textarea.className = "sitemap-output"
    textarea.style.width = "100%"
    textarea.style.height = "200px"
    textarea.readOnly = true
    document.body.appendChild(textarea)
  }
  textarea.value = xml
  hideLoadingModal()
}

function copyToClipboard() {
  const textarea = document.getElementById("sitemapOutput")
  navigator.clipboard
    .writeText(textarea.value)
    .then(() => alert("Sitemap copied to clipboard!"))
    .catch((err) => console.error("Failed to copy:", err))
}

function downloadSitemapTxt() {
  const text = document.getElementById("sitemapOutput").value
  const blob = new Blob([text], { type: "text/plain" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = "sitemap.txt"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
