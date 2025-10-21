const API_BASE = "https://citizenreport.byethost33.com/wp-json/wp/v2";
const JWT_LOGIN = "https://citizenreport.byethost33.com/wp-json/jwt-auth/v1/token";

// DEVICE READY 
document.addEventListener("deviceready", function() {

    // Request permissions
    if(cordova.plugins.diagnostic){
        cordova.plugins.diagnostic.requestCameraAuthorization(
            (status) => console.log("Camera permission: " + status),
            (err) => console.error("Camera permission error: " + err)
        );
        cordova.plugins.diagnostic.requestLocationAuthorization(
            (status) => console.log("Location permission: " + status),
            (err) => console.error("Location permission error: " + err)
        );
        cordova.plugins.diagnostic.requestExternalStorageAuthorization(
            (status) => console.log("Storage permission: " + status),
            (err) => console.error("Storage permission error: " + err)
        );
    }

    // Firebase push notifications 
    FirebasePlugin.getToken(
        token => console.log("Firebase token:", token),
        error => console.error("Error getting Firebase token:", error)
    );

    FirebasePlugin.onMessageReceived(
        notification => {
            console.log("Received notification:", notification);
            if(notification.body) showNotification(notification.body, "success");
        },
        error => console.error("Error receiving notification:", error)
    );

}, false);

// TOKEN & USER 
function getToken() { return localStorage.getItem("jwtToken"); }
function setUserEmail(email){ document.getElementById("userEmail").textContent = email; }

// NAVIGATION 
function hideAllSections(){
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("home-page").style.display = "none";
    document.getElementById("add-incident-page").style.display = "none";
    document.getElementById("browse-page").style.display = "none";
}

function showHome(){ 
    hideAllSections(); 
    getToken() ? document.getElementById("home-page").style.display="block" : document.getElementById("auth-section").style.display="block"; 
}
function showAddIncident(){ 
    hideAllSections(); 
    document.getElementById("add-incident-page").style.display="block"; 
    resetIncidentForm(); 
}
function showBrowse(){ 
    hideAllSections(); 
    document.getElementById("browse-page").style.display="block"; 
    fetchIncidents(); 
}

// LOGIN 
const loginForm = document.getElementById("loginForm");
loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const res = await fetch(JWT_LOGIN, {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({username,password})
        });
        const data = await res.json();
        if(data.token){
            localStorage.setItem("jwtToken", data.token);
            setUserEmail(username);
            showHome();
            loginForm.reset();
            showNotification("Login successful!", "success");
        } else {
            showNotification("Login failed! Check credentials.", "error");
        }
    } catch(err){
        console.error(err);
        showNotification("Login error! Check console.", "error");
    }
});

function logout(){
    localStorage.removeItem("jwtToken");
    showHome();
    showNotification("Logged out successfully!", "success");
}

// CATEGORIES 
const categoryMap = {
    "Accident": 4,
    "Domestic Violence": 25,
    "Drug Abuse": 19,
    "Fighting": 21,
    "Fire Outbreak": 15,
    "Flood/Natural Disaster": 26,
    "Health Emergency": 12,
    "Introduction": 5,
    "Other": 23,
    "Rioting": 20,
    "Building Collapse": null,
    "Robbery/Theft": null,
    "Traffic Violation": null,
    "Suspicious Activity": null
};

function populateCategories(){
    const addSelect = document.getElementById("category");
    const filterSelect = document.getElementById("filter");

    addSelect.innerHTML = `<option value="">-- Select Category --</option>`;
    filterSelect.innerHTML = `<option value="all">All</option>`;

    for(const [name,id] of Object.entries(categoryMap)){
        const optionAdd = document.createElement("option");
        optionAdd.value = id;
        optionAdd.textContent = name;
        addSelect.appendChild(optionAdd);

        const optionFilter = document.createElement("option");
        optionFilter.value = id;
        optionFilter.textContent = name;
        filterSelect.appendChild(optionFilter);
    }
}
populateCategories();

// INCIDENT FORM 
const incidentForm = document.getElementById("incidentForm");

incidentForm.addEventListener("submit", async e => {
    e.preventDefault();
    const token = getToken();
    if (!token) { showNotification("Please login first!", "error"); return; }

    const incidentId = document.getElementById("incidentId").value;
    const title = document.getElementById("title").value;
    const categoryId = document.getElementById("category").value;
    const location = document.getElementById("location").value;
    const latitude = document.getElementById("latitude").value;
    const longitude = document.getElementById("longitude").value;
    const description = document.getElementById("description").value;
    const imageInput = document.getElementById("image");

    try {
        let mediaId = null;
        let imageUrl = "";

        // Upload image first if exists
        if (imageInput.files.length > 0) {
            const imgFile = imageInput.files[0];
            const formData = new FormData();
            formData.append("file", imgFile);

            const res = await fetch(`${API_BASE}/media`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            mediaId = data.id;
            imageUrl = data.source_url;
        }

        // Prepare content (include image if uploaded)
        let content = `Location: ${location} (${latitude}, ${longitude})\n\n${description}`;
        if (imageUrl) content = `<img src="${imageUrl}" style="max-width:100%; margin-bottom:10px;">\n` + content;

        let url = `${API_BASE}/posts`;
        const postData = {
            title: title,
            content: content,
            status: "publish",
            categories: categoryId
        };
        if (mediaId) postData.featured_media = mediaId;

        if (incidentId) {
            url = `${API_BASE}/posts/${incidentId}`;
            postData._method = "PUT";
        }

        const postRes = await fetch(url, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(postData)
        });

        await postRes.json();
        showNotification(`Incident ${incidentId ? "updated" : "submitted"} successfully!`, "success");
        resetIncidentForm();
        showHome();
        fetchIncidents();
    } catch (err) {
        console.error(err);
        showNotification("Failed to submit incident.", "error");
    }
});

// RESET FORM 
function resetIncidentForm(){
    incidentForm.reset();
    document.getElementById("preview").style.display="none";
    document.getElementById("incidentId").value="";
}

// CAMERA 
function takePhoto(){
    navigator.camera.getPicture(
        function(imageURI){
            document.getElementById("preview").src=imageURI;
            document.getElementById("preview").style.display="block";
            window.resolveLocalFileSystemURL(imageURI, function(fileEntry){
                fileEntry.file(function(file){
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    document.getElementById("image").files = dataTransfer.files;
                });
            });
        },
        function(err){ showNotification("Camera error: "+err,"error"); },
        { quality:70, destinationType: Camera.DestinationType.FILE_URI, allowEdit:true, correctOrientation:true }
    );
}

// GEOLOCATION 
function getLocation(){
    if(!navigator.geolocation){ showNotification("Geolocation not supported","error"); return; }
    navigator.geolocation.getCurrentPosition(pos=>{
        const {latitude,longitude} = pos.coords;
        document.getElementById("latitude").value = latitude;
        document.getElementById("longitude").value = longitude;
        document.getElementById("location").value = `${latitude}, ${longitude}`;
        showNotification("Location captured!","success");
    }, err=>{ console.warn(err); showNotification("Failed to get location","error"); }, { enableHighAccuracy:true });
}

// FETCH INCIDENTS 
const incidentList = document.getElementById("incidentList");
const filter = document.getElementById("filter");
filter.addEventListener("change", e=>fetchIncidents(e.target.value));

async function fetchIncidents(categoryId="all"){
    const token = getToken();
    if(!token){ showNotification("Please login first!","error"); return; }
    try{
        const res = await fetch(`${API_BASE}/posts?per_page=50&_embed`);
        const data = await res.json();

        let filtered = data;
        if(categoryId!=="all"){
            const catIdInt = parseInt(categoryId);
            filtered = data.filter(post => post.categories.includes(catIdInt));
        }

        if(!filtered.length){ incidentList.innerHTML=`<p>No incidents reported yet.</p>`; return; }

        incidentList.innerHTML = filtered.map(post=>{
            const date = new Date(post.date).toLocaleString();
            const contentText = post.content.rendered;

            let img="";
            if(post._embedded && post._embedded["wp:featuredmedia"]) 
                img = post._embedded["wp:featuredmedia"][0].source_url;

            return `
                <div class="incident">
                  <h3>${post.title.rendered}</h3>
                  ${img ? `<img src="${img}" style="max-width:100%; margin-top:5px;">` : ""}
                  <div>${contentText}</div>
                  <p><strong>Posted on:</strong> ${date}</p>
                  <button onclick="editIncident(${post.id})">Edit</button>
                  <button onclick="deleteIncident(${post.id})">Delete</button>
                </div>
            `;
        }).join("");

    } catch(err){ console.error(err); incidentList.innerHTML=`<p>Error fetching incidents. Check console.</p>`; }
}

// EDIT 
async function editIncident(postId){
    const token = getToken();
    if(!token){ showNotification("Please login first","error"); return; }
    
    try{
        const res = await fetch(`${API_BASE}/posts/${postId}?_embed`);
        const post = await res.json();
        showAddIncident();

        document.getElementById("incidentId").value = post.id;
        document.getElementById("title").value = post.title.rendered;

        
        const parser = new DOMParser();
        const html = parser.parseFromString(post.content.rendered, "text/html");
        
        // Show image preview if exists
        const img = html.querySelector("img");
        if(img){
            document.getElementById("preview").src = img.src;
            document.getElementById("preview").style.display = "block";
        } else {
            document.getElementById("preview").style.display = "none";
        }

        // Extract text content for location and description
        const text = html.body.textContent || "";
        const locMatch = text.match(/\(([\d\.\-]+),([\d\.\-]+)\)/);
        if(locMatch){
            document.getElementById("latitude").value = locMatch[1];
            document.getElementById("longitude").value = locMatch[2];
            document.getElementById("location").value = `${locMatch[1]}, ${locMatch[2]}`;
        } else {
            document.getElementById("latitude").value = "";
            document.getElementById("longitude").value = "";
            document.getElementById("location").value = "";
        }

        
        document.getElementById("description").value = text.trim();

        showNotification("Editing incident...", "success");
    } catch(err){
        console.error(err);
        showNotification("Failed to fetch incident","error");
    }
}

// DELETE 
async function deleteIncident(postId){
    const token = getToken();
    if(!token){ showNotification("Please login first","error"); return; }
    if(!confirm("Are you sure you want to delete this incident?")) return;

    try{
        // Soft delete (works if DELETE blocked)
        await fetch(`${API_BASE}/posts/${postId}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: new URLSearchParams({ _method: "PUT", status: "draft" })
        });
        showNotification("Incident deleted successfully!", "success");
        fetchIncidents();
    } catch(err){ console.error(err); showNotification("Failed to delete incident","error"); }
}

// NOTIFICATIONS 
function showNotification(message,type="success"){
    const notify = document.getElementById("notification");
    notify.textContent = message;
    notify.className = `notification ${type}`;
    notify.style.display="block";
    setTimeout(()=>{ notify.style.display="none"; },4000);
}

// INIT 
showHome();
