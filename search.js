// search.js - Advanced Search with Firebase
console.log("🔍 Loading search.js...");

let currentSearchTerm = '';
let currentFilters = {};
let currentPage = 1;
const resultsPerPage = 10;
let totalResults = 0;

// Initialize search functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeSearch();
    
    // Listen for auth state to personalize results
    if (typeof auth !== 'undefined') {
        auth.onAuthStateChanged(user => {
            if (user) {
                console.log("User logged in, personalizing search...");
            }
        });
    }
});

function initializeSearch() {
    // Search button click
    document.getElementById('searchBtn').addEventListener('click', performSearch);
    
    // Enter key in search input
    document.getElementById('mainSearch').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Quick search tags
    document.querySelectorAll('.quick-search-tags .tag, .popular-tag').forEach(tag => {
        tag.addEventListener('click', function(e) {
            e.preventDefault();
            const searchTerm = this.getAttribute('data-search');
            document.getElementById('mainSearch').value = searchTerm;
            currentSearchTerm = searchTerm;
            performSearch();
        });
    });
    
    // Filter changes trigger search
    document.querySelectorAll('#filterCategory, #filterClass, #filterBoard, #filterCondition, #sortBy').forEach(filter => {
        filter.addEventListener('change', function() {
            if (currentSearchTerm || Object.keys(currentFilters).length > 0) {
                performSearch();
            }
        });
    });
    
    // Price range inputs
    document.getElementById('minPrice').addEventListener('change', performSearch);
    document.getElementById('maxPrice').addEventListener('change', performSearch);
    
    // Clear filters button
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
    
    // Pagination buttons
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));
    
    // Load initial popular results
    loadPopularBooks();
}

async function performSearch() {
    // Get search term
    currentSearchTerm = document.getElementById('mainSearch').value.trim();
    
    // Get filters
    currentFilters = {
        category: document.getElementById('filterCategory').value,
        class: document.getElementById('filterClass').value,
        board: document.getElementById('filterBoard').value,
        condition: document.getElementById('filterCondition').value,
        sortBy: document.getElementById('sortBy').value,
        minPrice: document.getElementById('minPrice').value ? parseInt(document.getElementById('minPrice').value) : null,
        maxPrice: document.getElementById('maxPrice').value ? parseInt(document.getElementById('maxPrice').value) : null
    };
    
    // Reset to page 1
    currentPage = 1;
    
    // Show loading
    showLoading(true);
    
    try {
        const results = await searchFirebase(currentSearchTerm, currentFilters, currentPage);
        displayResults(results);
    } catch (error) {
        console.error("Search error:", error);
        showError("Search failed. Please try again.");
    }
}

async function searchFirebase(searchTerm, filters, page = 1) {
    console.log("🔍 Searching Firebase with:", { searchTerm, filters, page });
    
    let results = [];
    let booksQuery = db.collection("books").where("status", "==", "available");
    let exchangesQuery = db.collection("exchanges");
    let materialsQuery = db.collection("materials");
    
    // Apply text search if search term exists
    if (searchTerm && searchTerm.length > 0) {
        // Convert to lowercase for case-insensitive search
        const searchLower = searchTerm.toLowerCase();
        
        // Search across multiple collections
        const [booksSnapshot, exchangesSnapshot, materialsSnapshot] = await Promise.all([
            booksQuery.get(),
            exchangesQuery.get(),
            materialsQuery.get()
        ]);
        
        // Filter books
        booksSnapshot.forEach(doc => {
            const data = doc.data();
            if (matchesSearch(data, searchLower, filters, 'book')) {
                results.push({
                    id: doc.id,
                    type: 'book',
                    title: data.title,
                    class: data.class,
                    subject: data.subject,
                    board: data.board,
                    price: data.price,
                    condition: data.condition,
                    description: data.description,
                    createdAt: data.createdAt,
                    userEmail: data.userEmail,
                    userName: data.userName,
                    ...data
                });
            }
        });
        
        // Filter exchanges (you'll need to create exchanges collection)
        exchangesSnapshot.forEach(doc => {
            const data = doc.data();
            if (matchesSearch(data, searchLower, filters, 'exchange')) {
                results.push({
                    id: doc.id,
                    type: 'exchange',
                    ...data
                });
            }
        });
        
        // Filter materials (you'll need to create materials collection)
        materialsSnapshot.forEach(doc => {
            const data = doc.data();
            if (matchesSearch(data, searchLower, filters, 'material')) {
                results.push({
                    id: doc.id,
                    type: 'material',
                    ...data
                });
            }
        });
    } else {
        // No search term, just apply filters
        const booksSnapshot = await booksQuery.get();
        booksSnapshot.forEach(doc => {
            const data = doc.data();
            if (matchesFilters(data, filters)) {
                results.push({
                    id: doc.id,
                    type: 'book',
                    ...data
                });
            }
        });
    }
    
    // Apply additional filters
    results = results.filter(item => matchesFilters(item, filters));
    
    // Apply sorting
    results = sortResults(results, filters.sortBy);
    
    // Calculate pagination
    totalResults = results.length;
    const startIndex = (page - 1) * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;
    const paginatedResults = results.slice(startIndex, endIndex);
    
    return {
        results: paginatedResults,
        total: totalResults,
        page: page,
        totalPages: Math.ceil(totalResults / resultsPerPage)
    };
}

function matchesSearch(item, searchTerm, filters, type) {
    // Combine relevant fields into search string
    let searchFields = [];
    
    switch(type) {
        case 'book':
            searchFields = [
                item.title,
                item.subject,
                item.class,
                item.board,
                item.description,
                item.userName
            ].filter(f => f).join(' ').toLowerCase();
            break;
        case 'exchange':
            searchFields = [
                item.haveBook,
                item.needBook,
                item.haveClass,
                item.needClass,
                item.notes
            ].filter(f => f).join(' ').toLowerCase();
            break;
        case 'material':
            searchFields = [
                item.title,
                item.subject,
                item.class,
                item.description,
                item.tags
            ].filter(f => f).join(' ').toLowerCase();
            break;
    }
    
    // Check if search term exists in any field
    return searchFields.includes(searchTerm);
}

function matchesFilters(item, filters) {
    // Category filter
    if (filters.category && item.type !== filters.category) {
        return false;
    }
    
    // Class filter
    if (filters.class) {
        const itemClass = item.class ? item.class.toLowerCase() : '';
        if (!itemClass.includes(filters.class.toLowerCase())) {
            return false;
        }
    }
    
    // Board filter
    if (filters.board && item.board !== filters.board) {
        return false;
    }
    
    // Condition filter (for books only)
    if (filters.condition && item.type === 'book' && item.condition !== filters.condition) {
        return false;
    }
    
    // Price range filter (for books only)
    if (item.type === 'book' && item.price) {
        if (filters.minPrice && item.price < filters.minPrice) {
            return false;
        }
        if (filters.maxPrice && item.price > filters.maxPrice) {
            return false;
        }
    }
    
    return true;
}

function sortResults(results, sortBy) {
    return results.sort((a, b) => {
        switch(sortBy) {
            case 'price_low':
                return (a.price || 0) - (b.price || 0);
            case 'price_high':
                return (b.price || 0) - (a.price || 0);
            case 'recent':
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            case 'popular':
                return (b.views || 0) - (a.views || 0);
            default:
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
    });
}

function displayResults(searchResult) {
    const container = document.getElementById('resultsContainer');
    const title = document.getElementById('resultsTitle');
    const count = document.getElementById('resultsCount');
    const pagination = document.getElementById('pagination');
    
    showLoading(false);
    
    // Update title and count
    count.textContent = searchResult.total;
    title.textContent = searchResult.total === 0 ? 'No Results Found' : 'Search Results';
    
    if (searchResult.total === 0) {
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <h3>No matching books or materials found</h3>
                <p>Try different keywords or adjust your filters.</p>
                <button onclick="clearFilters()" class="suggest-btn">Clear Filters</button>
            </div>
        `;
        pagination.style.display = 'none';
        return;
    }
    
    // Display results
    container.innerHTML = searchResult.results.map(item => createResultCard(item)).join('');
    
    // Update pagination
    updatePagination(searchResult.page, searchResult.totalPages);
    pagination.style.display = searchResult.totalPages > 1 ? 'flex' : 'none';
}

function createResultCard(item) {
    let cardHTML = '';
    
    switch(item.type) {
        case 'book':
            cardHTML = `
                <div class="result-card book-card">
                    <div class="result-badge book">For Sale</div>
                    <div class="result-content">
                        <h3>${escapeHTML(item.title)}</h3>
                        <div class="result-meta">
                            <span class="meta-item">📚 ${escapeHTML(item.subject || 'General')}</span>
                            <span class="meta-item">🎓 ${escapeHTML(item.class)}</span>
                            <span class="meta-item">🏛️ ${escapeHTML(item.board)}</span>
                        </div>
                        <div class="result-details">
                            <div class="price-tag">₨${item.price ? item.price.toLocaleString() : 'N/A'}</div>
                            <div class="condition">${escapeHTML(item.condition)} Condition</div>
                        </div>
                        <p class="result-description">${escapeHTML(item.description || 'No description available').substring(0, 100)}...</p>
                        <div class="result-footer">
                            <span class="user-info">👤 ${escapeHTML(item.userName || 'Unknown')}</span>
                            <span class="time">📅 ${formatDate(item.createdAt)}</span>
                            <button onclick="viewItem('book', '${item.id}')" class="view-btn">View Details</button>
                        </div>
                    </div>
                </div>
            `;
            break;
            
        case 'exchange':
            cardHTML = `
                <div class="result-card exchange-card">
                    <div class="result-badge exchange">Exchange</div>
                    <div class="exchange-pair">
                        <div class="exchange-from">
                            <div class="book-badge have">HAVE</div>
                            <h4>${escapeHTML(item.haveBook)}</h4>
                            <p>${escapeHTML(item.haveClass)} • ${escapeHTML(item.haveBoard)}</p>
                        </div>
                        <div class="exchange-arrow-small">⇄</div>
                        <div class="exchange-to">
                            <div class="book-badge need">NEED</div>
                            <h4>${escapeHTML(item.needBook)}</h4>
                            <p>${escapeHTML(item.needClass)} • ${escapeHTML(item.needBoard)}</p>
                        </div>
                    </div>
                    <div class="result-footer">
                        <span class="status">🔄 Seeking Exchange</span>
                        <button onclick="viewItem('exchange', '${item.id}')" class="view-btn">View Exchange</button>
                    </div>
                </div>
            `;
            break;
            
        case 'material':
            cardHTML = `
                <div class="result-card material-card">
                    <div class="result-badge material">Study Material</div>
                    <div class="result-content">
                        <h3>${escapeHTML(item.title)}</h3>
                        <div class="result-meta">
                            <span class="meta-item">📄 ${escapeHTML(item.docType)}</span>
                            <span class="meta-item">🎓 ${escapeHTML(item.class)}</span>
                            <span class="meta-item">📚 ${escapeHTML(item.subject)}</span>
                        </div>
                        <p class="result-description">${escapeHTML(item.description).substring(0, 120)}...</p>
                        <div class="result-footer">
                            <span class="downloads">📥 ${item.downloads || 0} Downloads</span>
                            <span class="rating">⭐ ${item.rating || 'N/A'}</span>
                            <button onclick="downloadMaterial('${item.id}')" class="download-btn">Download</button>
                        </div>
                    </div>
                </div>
            `;
            break;
    }
    
    return cardHTML;
}

function updatePagination(currentPage, totalPages) {
    document.querySelector('.current-page').textContent = currentPage;
    document.querySelector('.total-pages').textContent = totalPages;
    
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

function changePage(delta) {
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    
    showLoading(true);
    searchFirebase(currentSearchTerm, currentFilters, currentPage)
        .then(displayResults)
        .catch(error => {
            console.error("Pagination error:", error);
            showLoading(false);
        });
}

function clearFilters() {
    document.getElementById('mainSearch').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterClass').value = '';
    document.getElementById('filterBoard').value = '';
    document.getElementById('filterCondition').value = '';
    document.getElementById('sortBy').value = 'recent';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    
    currentSearchTerm = '';
    currentFilters = {};
    currentPage = 1;
    
    // Load popular books again
    loadPopularBooks();
}

function loadPopularBooks() {
    if (typeof db === 'undefined') return;
    
    showLoading(true);
    
    db.collection("books")
        .where("status", "==", "available")
        .orderBy("createdAt", "desc")
        .limit(8)
        .get()
        .then(snapshot => {
            showLoading(false);
            
            if (snapshot.empty) {
                document.getElementById('resultsContainer').innerHTML = `
                    <div class="no-results">
                        <div class="no-results-icon">📚</div>
                        <h3>No books available yet</h3>
                        <p>Be the first to list a book!</p>
                    </div>
                `;
                return;
            }
            
            const results = [];
            snapshot.forEach(doc => {
                results.push({
                    id: doc.id,
                    type: 'book',
                    ...doc.data()
                });
            });
            
            displayResults({
                results: results,
                total: results.length,
                page: 1,
                totalPages: 1
            });
            
            document.getElementById('resultsTitle').textContent = 'Recently Added Books';
            document.getElementById('resultsCount').textContent = results.length;
        })
        .catch(error => {
            console.error("Error loading popular books:", error);
            showLoading(false);
        });
}

function viewItem(type, id) {
    if (type === 'book') {
        window.location.href = `book-details.html?id=${id}`;
    } else if (type === 'exchange') {
        window.location.href = `exchange-details.html?id=${id}`;
    } else {
        alert(`Viewing ${type} with ID: ${id}`);
    }
}

function downloadMaterial(materialId) {
    alert(`Downloading material: ${materialId}\n\nIn a real implementation, this would download the file.`);
}

function showLoading(show) {
    document.getElementById('loadingResults').style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = `
        <div class="error-message">
            <div class="error-icon">⚠️</div>
            <h3>Search Error</h3>
            <p>${message}</p>
            <button onclick="performSearch()" class="retry-btn">Try Again</button>
        </div>
    `;
    showLoading(false);
}

function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(date) {
    if (!date) return 'Unknown date';
    
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
        return `${diffMins} min ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return d.toLocaleDateString();
    }
}

// Make functions globally available
window.performSearch = performSearch;
window.clearFilters = clearFilters;
window.viewItem = viewItem;
window.downloadMaterial = downloadMaterial;