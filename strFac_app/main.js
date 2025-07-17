// main.js
import { parseCifInfo } from './parseCIF.js';
import { performCrystallographicAnalysis } from './performCrystallographicAnalysis.js';

// Global variable to store parsed data (accessible by performCrystallographicAnalysis)
let currentParsedCifData = null;

// DOM elements
const fileInput = document.getElementById("cifFile");
const messageDisplay = document.getElementById("message");
const statusDisplay = document.getElementById("status"); // Added status display

// Elements for summary display
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

// Main file handling function
function handleFileSelection(event) {
  const file = event.target.files[0];
  messageDisplay.textContent = ""; // Clear previous messages
  clearSummaryDisplay(); // Clear summary on new file selection
  statusDisplay.textContent = "Processing file...";

  if (!file) {
    showMessage("No file selected. Please choose a file.", "error");
    statusDisplay.textContent = "Upload a CIF file to begin.";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const cifInfo = reader.result.toString();
    console.log("CIF Content (raw):\n", cifInfo); // Still log to console for debugging

    currentParsedCifData = parseCifInfo(cifInfo); // Call the parsing function

    if (!currentParsedCifData) {
      showMessage("Failed to parse CIF file. Check console for details.", "error");
      statusDisplay.textContent = "Error parsing CIF file.";
      return;
    }

    // Update the HTML display with the parsed information
    displaySpaceGroup.textContent = currentParsedCifData.spaceGroupName || "N/A";
    let elementsDisplay = [];
    if (currentParsedCifData.chemicalComponents.element1) elementsDisplay.push(currentParsedCifData.chemicalComponents.element1);
    if (currentParsedCifData.chemicalComponents.element2) elementsDisplay.push(currentParsedCifData.chemicalComponents.element2);
    displayElements.textContent = elementsDisplay.join(', ') || "N/A";

    displayA.textContent = currentParsedCifData.cellParameters.a !== undefined ? currentParsedCifData.cellParameters.a.toFixed(4) : "N/A";
    displayB.textContent = currentParsedCifData.cellParameters.b !== undefined ? currentParsedCifData.cellParameters.b.toFixed(4) : "N/A";
    displayC.textContent = currentParsedCifData.cellParameters.c !== undefined ? currentParsedCifData.cellParameters.c.toFixed(4) : "N/A";
    displayAlpha.textContent = currentParsedCifData.cellParameters.alpha !== undefined ? currentParsedCifData.cellParameters.alpha.toFixed(2) : "N/A";
    displayBeta.textContent = currentParsedCifData.cellParameters.beta !== undefined ? currentParsedCifData.cellParameters.beta.toFixed(2) : "N/A";
    displayGamma.textContent = currentParsedCifData.cellParameters.gamma !== undefined ? currentParsedCifData.cellParameters.gamma.toFixed(2) : "N/A";

    // Perform crystallographic calculations and visualization using the parsed data
    // Pass the planeInput value directly
    performCrystallographicAnalysis(currentParsedCifData, planeInput.value, showMessage);

    showMessage("CIF file processed successfully!", "success");
    statusDisplay.textContent = "CIF file loaded. View crystal structure and diffraction pattern.";
  };

  reader.onerror = () => {
    showMessage("Error reading the file. Please try again.", "error");
    statusDisplay.textContent = "Error reading file.";
  };
  reader.readAsText(file);
}

// Event Listeners
fileInput.addEventListener("change", handleFileSelection);

updatePlotButton.addEventListener('click', () => {
    if (currentParsedCifData) {
        // Re-run analysis with potentially new plane input
        performCrystallographicAnalysis(currentParsedCifData, planeInput.value, showMessage);
        showMessage("Diffraction view updated!", "success");
    } else {
        showMessage("Please upload a CIF file first.", "error");
    }
});

// Initial status message
window.addEventListener('load', () => {
    statusDisplay.textContent = 'Upload a CIF file to begin.';
});