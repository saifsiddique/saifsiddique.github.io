// main.js
import { parseCifInfo } from './parseCIF.js';
import { performCrystallographicAnalysis, getDirectLatticeVectors, getReciprocalLatticeVectors, getMillerIndicesFromCamera } from './performCrystallographicAnalysis.js';

// Global variables 
let currentParsedCifData = null;
let debounceTimeoutForCamera = null; 
let currentCamera = null; 

// get DOM elements
const fileInput = document.getElementById("cifFile");
const messageDisplay = document.getElementById("message");
const statusDisplay = document.getElementById("status");

// define elements for CIF summary display
const displaySpaceGroup = document.getElementById("displaySpaceGroup");
const displayElements = document.getElementById("displayElements");
const displayA = document.getElementById("displayA");
const displayB = document.getElementById("displayB");
const displayC = document.getElementById("displayC");
const displayAlpha = document.getElementById("displayAlpha");
const displayBeta = document.getElementById("displayBeta");
const displayGamma = document.getElementById("displayGamma");
const updatePlotButton = document.getElementById("updatePlotButton");
const planeInput = document.getElementById("planeInput");
const structureCanvas = document.getElementById("structureCanvas"); 


// Helper function to display messages
function showMessage(message, type) {
  messageDisplay.textContent = message;
  messageDisplay.style.color = type === "error" ? "red" : "green";
}

// Function to clear summary display
function clearSummaryDisplay() {
  displaySpaceGroup.textContent = "N/A";
  displayElements.textContent = "N/A";
  displayA.textContent = "N/A";
  displayB.textContent = "N/A";
  displayC.textContent = "N/A";
  displayAlpha.textContent = "N/A";
  displayBeta.textContent = "N/A";
  displayGamma.textContent = "N/A";
}

// Function to update the plots and UI based on new plane
function updatePlotsAndUI(planeStr, cameraState = null) { 
    if (currentParsedCifData) { //
        // Update the Miller Plane input field
        planeInput.value = planeStr; //
        // Re-run analysis with the new plane input
        // Pass the camera state to performCrystallographicAnalysis
        performCrystallographicAnalysis(currentParsedCifData, planeStr, showMessage, cameraState);
        showMessage("Diffraction view updated!", "success"); //
    } else {
        showMessage("Please upload a CIF file first.", "error"); //
    }
}


// Main file handling function
function handleFileSelection(event) {
  const file = event.target.files[0]; //
  messageDisplay.textContent = ""; // Clear previous messages
  clearSummaryDisplay(); // Clear summary on new file selection
  statusDisplay.textContent = "Processing file..."; //

  if (!file) { //
    showMessage("No file selected. Please choose a file.", "error"); //
    statusDisplay.textContent = "Upload a CIF file to begin."; //
    return; //
  }

  const reader = new FileReader(); //
  reader.onload = () => { //
    const cifInfo = reader.result.toString(); //
    // console.log("CIF Content (raw):\n", cifInfo); // for debugging

    currentParsedCifData = parseCifInfo(cifInfo); // Call the parsing function

    if (!currentParsedCifData) { //
      showMessage("Failed to parse CIF file. Check console for details.", "error"); //
      statusDisplay.textContent = "Error parsing CIF file."; //
      return; //
    }

    // Display the parsed information
    displaySpaceGroup.textContent = currentParsedCifData.spaceGroupName || "N/A";
    let elementsDisplay = []; //
    if (currentParsedCifData.chemicalComponents.element1) elementsDisplay.push(currentParsedCifData.chemicalComponents.element1);
    if (currentParsedCifData.chemicalComponents.element2) elementsDisplay.push(currentParsedCifData.chemicalComponents.element2);
    displayElements.textContent = elementsDisplay.join(', ') || "N/A"; //

    displayA.textContent = currentParsedCifData.cellParameters.a !== undefined ? currentParsedCifData.cellParameters.a.toFixed(4) : "N/A";
    displayB.textContent = currentParsedCifData.cellParameters.b !== undefined ? currentParsedCifData.cellParameters.b.toFixed(4) : "N/A";
    displayC.textContent = currentParsedCifData.cellParameters.c !== undefined ? currentParsedCifData.cellParameters.c.toFixed(4) : "N/A";
    displayAlpha.textContent = currentParsedCifData.cellParameters.alpha !== undefined ? currentParsedCifData.cellParameters.alpha.toFixed(2) : "N/A";
    displayBeta.textContent = currentParsedCifData.cellParameters.beta !== undefined ? currentParsedCifData.cellParameters.beta.toFixed(2) : "N/A";
    displayGamma.textContent = currentParsedCifData.cellParameters.gamma !== undefined ? currentParsedCifData.cellParameters.gamma.toFixed(2) : "N/A";

    // Initial plotting
    updatePlotsAndUI(planeInput.value);

    showMessage("CIF file processed successfully!", "success");
    statusDisplay.textContent = "CIF file loaded. View crystal structure and diffraction pattern."; //

    // The following block of code is AI generated to handle camera updates

    // Initial camera state after the first plot is rendered
    // We can reliably get the layout here because Plotly.react has just been called.
    // If there's still an issue, consider a small setTimeout here.
    // However, the `plotly_relayout` event itself is the more robust place to get *subsequent* camera updates.
    if (typeof Plotly !== 'undefined' && typeof Plotly.getLayout === 'function') {
        currentCamera = Plotly.getLayout('structureCanvas').scene.camera;
    }


    // --- NEW: Add Plotly camera listener after the chart is initialized ---
    // This listener should be added only once the Plotly div is ready and plot is created.
    // Plotly.react ensures the div is ready.
    structureCanvas.on('plotly_relayout', (eventdata) => {
        // Check if the event data contains camera information, which is typically under 'scene.camera.eye'
        // or directly 'scene.camera' if the entire camera object is updated.
        if (eventdata['scene.camera.eye'] || (eventdata['scene.camera'] && eventdata['scene.camera'].eye)) {
            clearTimeout(debounceTimeoutForCamera);
            debounceTimeoutForCamera = setTimeout(() => {
                // Extract the new camera eye directly from the event data.
                // This is the most reliable way to get the camera state that triggered the relayout.
                const newCameraEye = eventdata['scene.camera.eye'] || eventdata['scene.camera'].eye;

                // Also, capture the full camera state from the event data, if available.
                // This is crucial for maintaining zoom and orientation when re-plotting.
                const newCameraState = eventdata['scene.camera'] || currentCamera; // Prioritize eventdata, fall back to currentCamera
                // Ensure eye, center, up are correctly set in newCameraState if not directly in eventdata['scene.camera']
                if (newCameraState && !newCameraState.eye) newCameraState.eye = newCameraEye;
                // If center or up are not explicitly in eventdata['scene.camera'], they might not be updated.
                // For 'orthographic' projection and 'aspectmode: data', these are often managed by Plotly,
                // but explicitly copying them ensures persistence.
                if (currentCamera && !newCameraState.center) newCameraState.center = currentCamera.center;
                if (currentCamera && !newCameraState.up) newCameraState.up = currentCamera.up;

                currentCamera = newCameraState; // Update global currentCamera with the latest state


                if (newCameraEye && currentParsedCifData) { //
                    // Get direct and reciprocal lattice vectors from the parsed data
                    // These are needed for the Miller index conversion
                    const directLatticeVectors = getDirectLatticeVectors(currentParsedCifData.cellParameters);
                    const reciprocalLatticeVectors = getReciprocalLatticeVectors(directLatticeVectors);

                    if (!directLatticeVectors || !reciprocalLatticeVectors) { //
                        console.error("Lattice vectors not available for camera conversion."); //
                        return; //
                    }

                    const millerIndices = getMillerIndicesFromCamera( //
                        newCameraEye, // Use the extracted newCameraEye for Miller index calculation
                        directLatticeVectors, //
                        reciprocalLatticeVectors //
                    );

                    if (millerIndices && millerIndices.length === 3) { //
                        const hklString = `${millerIndices[0]},${millerIndices[1]},${millerIndices[2]}`; //
                        console.log("Derived HKL from camera:", hklString); //
                        // Update UI and re-plot, passing the current (updated) camera state
                        updatePlotsAndUI(hklString, currentCamera);
                    } else {
                        console.warn("Could not derive valid Miller indices from camera position."); //
                    }
                }
            }, 200); 
        }
    });

  };

  reader.onerror = () => { //
    showMessage("Error reading the file. Please try again.", "error"); //
    statusDisplay.textContent = "Error reading file."; //
  };
  reader.readAsText(file); //
}


// Event Listeners
fileInput.addEventListener("change", handleFileSelection); //

// "Update Diffraction View" button
updatePlotButton.addEventListener('click', () => { //
    if (currentParsedCifData) { //
        // When clicking the button, we want to update based on the text input,
        // but *maintain* the current camera view.
        // So, we pass currentCamera.
        updatePlotsAndUI(planeInput.value, currentCamera); //
    } else {
        showMessage("Please upload a CIF file first.", "error"); //
    }
});


// Initial message
window.addEventListener('load', () => { //
    statusDisplay.textContent = 'Upload a CIF file to begin.'; //
});