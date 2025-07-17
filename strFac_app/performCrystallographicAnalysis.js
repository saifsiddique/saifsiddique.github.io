// performCrystallographicAnalysis.js

// This function performs the crystallographic calculations and updates the plots.
// It receives the parsed data from parseCIF.js and the plane input from main.js.
// It also receives the showMessage function for displaying errors/status.
export function performCrystallographicAnalysis(parsedData, inputPlaneStr, showMessage) {
    // Destructure the necessary data from the parsedData object
    const { cellParameters, chemicalComponents, atomPositions, spaceGroupName } = parsedData;
    const { a: cellLengthA, b: cellLengthB, c: cellLengthC, alpha: cellAlphaAngle, beta: cellBetaAngle, gamma: cellGammaAngle } = cellParameters;
    const { element1, element2 } = chemicalComponents;

    if (atomPositions.length === 0 || !cellLengthA || !cellLengthB || !cellLengthC) {
        showMessage("Missing essential data for crystallographic analysis (atoms or cell parameters). Please upload a valid CIF file.", "error");
        return;
    }

    // --- Helper Math Functions (private to this module) ---
    function crossProduct(v1, v2) {
        return [
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0]
        ];
    }

    function dotProduct(v1, v2) {
        return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    }

    const multiplyMatrices = (a, b) => {
        if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length || !a[0].length || !b[0].length) {
           // console.error('Arguments should be non-empty 2-dimensional arrays for matrix multiplication.');
           return []; // Return empty array or throw specific error
        }
        const x = a.length;
        const z = a[0].length;
        const y = b[0].length;
        if (b.length !== z) {
           // console.error('Number of columns in the first matrix must match number of rows in the second.');
           return []; // Return empty array or throw specific error
        }

        const product = Array(x).fill(0).map(() => Array(y).fill(0));

        for (let i = 0; i < x; i++) {
           for (let j = 0; j < y; j++) {
              for (let k = 0; k < z; k++) {
                 product[i][j] += a[i][k] * b[k][j];
              }
           }
        }
        return product;
    };

    function normalizeVector(v) {
        const magnitude = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
        if (magnitude === 0) return [0, 0, 0];
        return v.map(val => val / magnitude);
    }

    // --- Reciprocal Lattice Vectors ---
    // Convert angles to radians
    const alphaRad = cellAlphaAngle * Math.PI / 180;
    const betaRad = cellBetaAngle * Math.PI / 180;
    const gammaRad = cellGammaAngle * Math.PI / 180;

    // Direct lattice vectors (simplified Cartesian for this example, as in original code)
    // IMPORTANT: For non-orthorhombic cells (like monoclinic in your example),
    // a more rigorous conversion from cell parameters to Cartesian vectors is needed
    // to accurately calculate reciprocal lattice vectors.
    // The current simplified vectors assume orthogonal axes, which is an approximation
    // for monoclinic or triclinic systems in this context.
    let a_vec = [cellLengthA, 0, 0];
    let b_vec = [0, cellLengthB, 0];
    let c_vec = [0, 0, cellLengthC];

    let bCrossC = crossProduct(b_vec, c_vec);
    let vol = dotProduct(a_vec, bCrossC);

    if (vol === 0) {
        showMessage("Unit cell volume is zero, cannot calculate reciprocal lattice vectors.", "error");
        return;
    }

    let aStar = bCrossC.map(x => x / vol);
    let bStar = crossProduct(c_vec, a_vec).map(x => x / vol);
    let cStar = crossProduct(a_vec, b_vec).map(x => x / vol);

    let reciprocalLatticeVectors = [aStar, bStar, cStar];
    console.log("Reciprocal Lattice Vectors (a*, b*, c*):", reciprocalLatticeVectors);

    // --- Calculate Structure Factors for all planes ---
    const millerIndicesRangeH = [-5, 5];
    const millerIndicesRangeK = [-5, 5];
    const millerIndicesRangeL = [-25, 25];

    const listofPlanes = [];
    const structureFactors = {}; // Stores { "h,k,l": magnitude }
    const structureFactorMagnitudes = []; // Stores magnitudes in order for dataPoints

    for (let h = millerIndicesRangeH[0]; h <= millerIndicesRangeH[1]; h++) {
        for (let k = millerIndicesRangeK[0]; k <= millerIndicesRangeK[1]; k++) {
            for (let l = millerIndicesRangeL[0]; l <= millerIndicesRangeL[1]; l++) {
                listofPlanes.push([h, k, l]);

                let F_re = 0;
                let F_im = 0;

                atomPositions.forEach(atom => {
                    const angle = 2 * Math.PI * (h * atom.x + k * atom.y + l * atom.z);
                    F_re += Math.cos(angle);
                    F_im += Math.sin(angle);
                });

                const magnitude = Math.sqrt(F_re ** 2 + F_im ** 2);
                structureFactors[`${h},${k},${l}`] = magnitude;
                structureFactorMagnitudes.push(magnitude);
            }
        }
    }
    console.log("Calculated Structure Factors:", structureFactors);

    // --- Visualization Data Preparation ---
    let inputPlane = inputPlaneStr.split('').map(Number); // Convert string "120" to [1,2,0]

    if (inputPlane.length !== 3 || inputPlane.some(isNaN)) {
        console.warn("Invalid plane input, defaulting to [1,2,0]");
        inputPlane = [1, 2, 0];
    }

    // Calculate the reciprocal lattice vector G_hkl which is normal to the (hkl) plane
    const g_hkl = [
        inputPlane[0] * aStar[0] + inputPlane[1] * bStar[0] + inputPlane[2] * cStar[0],
        inputPlane[0] * aStar[1] + inputPlane[1] * bStar[1] + inputPlane[2] * cStar[1],
        inputPlane[0] * aStar[2] + inputPlane[1] * bStar[2] + inputPlane[2] * cStar[2]
    ];
    const normalPlaneVector = normalizeVector(g_hkl);
    console.log("Normal vector to desired plane:", normalPlaneVector);

    // Create a new orthogonal basis for projection: xVector, yVector, and normalPlaneVector
    const dummyVector = Math.abs(normalPlaneVector[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; // Choose a dummy vector not parallel to normal
    let yVector = crossProduct(dummyVector, normalPlaneVector);
    yVector = normalizeVector(yVector);
    let xVector = crossProduct(normalPlaneVector, yVector); // x = n x y (forms a right-handed system)
    xVector = normalizeVector(xVector);

    // Project reciprocal lattice points (from listofPlanes) onto this new basis
    const projectedCoords = listofPlanes.map(([h,k,l]) => {
        // Each [h,k,l] represents a reciprocal lattice vector G = h*a* + k*b* + l*c*
        const gVec = [
            h * aStar[0] + k * bStar[0] + l * cStar[0],
            h * aStar[1] + k * bStar[1] + l * cStar[1],
            h * aStar[2] + k * bStar[2] + l * cStar[2]
        ];
        // Project gVec onto xVector and yVector for the 2D plot
        return [
            dotProduct(gVec, xVector), // X-coordinate in the new basis
            dotProduct(gVec, yVector), // Y-coordinate in the new basis
            dotProduct(gVec, normalPlaneVector) // Z-coordinate (component along the normal)
        ];
    });
    console.log("Projected Reciprocal Space Coordinates:", projectedCoords);

    // Prepare data for diffraction pattern visualization
    let diffractionDataPoints = [];
    projectedCoords.forEach((coords, index) => {
        const magnitude = structureFactorMagnitudes[index];
        if (magnitude > 0.001) { // Filter out very weak reflections
            diffractionDataPoints.push({
                x: coords[0],
                y: coords[1],
                label: listofPlanes[index].join(','), // Label with h,k,l
                markerSize: (magnitude / 5) ** 2 // Scale marker size by (SF / constant)^2
            });
        }
    });
    console.log("Diffraction Data Points:", diffractionDataPoints);

    // --- Plotly for Crystal Structure ---
    const atomsType1X = [];
    const atomsType1Y = [];
    const atomsType1Z = [];
    const atomsType2X = [];
    const atomsType2Y = [];
    const atomsType2Z = [];

    atomPositions.forEach(atom => {
        if (atom.label === element1) {
            atomsType1X.push(atom.x);
            atomsType1Y.push(atom.y);
            atomsType1Z.push(atom.z);
        } else if (atom.label === element2) {
            atomsType2X.push(atom.x);
            atomsType2Y.push(atom.y);
            atomsType2Z.push(atom.z);
        }
    });

    const traceType1 = {
        x: atomsType1X,
        y: atomsType1Y,
        z: atomsType1Z,
        mode: 'markers',
        marker: {
            size: 12,
            line: {
                color: 'rgba(65, 192, 234, 0.14)',
                width: 0.5
            },
            opacity: 0.8
        },
        type: 'scatter3d',
        name: element1 || 'Element 1'
    };

    const traceType2 = {
        x: atomsType2X,
        y: atomsType2Y,
        z: atomsType2Z,
        mode: 'markers',
        marker: {
            size: 12,
            line: {
                color: 'rgba(217, 217, 217, 0.14)',
                width: 0.5
            },
            opacity: 0.8
        },
        type: 'scatter3d',
        name: element2 || 'Element 2'
    };

    const plotlyLayout = {
        title: {
            text: `Crystal Structure (${inputPlaneStr} plane normal)<br>Space Group: ${spaceGroupName}`
        },
        legend: {
            font: {
                size: 20
            }
        },
        scene: {
            xaxis: { title: 'X (fractional)' },
            yaxis: { title: 'Y (fractional)' },
            zaxis: { title: 'Z (fractional)' },
            camera: {
                eye: {
                    x: normalPlaneVector[0] * 2, // Position camera further out along the normal
                    y: normalPlaneVector[1] * 2,
                    z: normalPlaneVector[2] * 2
                },
                up: {
                    x: xVector[0], // Align 'up' with one of the in-plane vectors
                    y: xVector[1],
                    z: xVector[2]
                }
            }
        }
    };

    const plotlyData = [traceType1, traceType2].filter(trace => trace.x.length > 0);
    Plotly.newPlot('structureCanvas', plotlyData, plotlyLayout, { displayModeBar: false });

    // --- CanvasJS for Diffraction Pattern ---
    const canvasjsChart = new CanvasJS.Chart("diffractionCanvas", {
        axisX: {
            gridThickness: 0,
            lineThickness: 1,
            tickThickness: 0,
            minimum: -1.0,
            maximum: 1.0,
            labelFormatter: function() { return ""; }
        },
        axisY: {
            gridThickness: 0,
            lineThickness: 1,
            tickThickness: 0,
            minimum: -1.0,
            maximum: 1.0,
            labelFormatter: function() { return ""; }
        },
        title: {
            text: `Diffraction Pattern for (${inputPlaneStr}) plane`,
            fontFamily: 'tahoma',
            fontSize: 30
        },
        data: [{
            type: "scatter",
            markerColor: "black",
            toolTipContent: "({label})<br/>Intensity: {markerSize}",
            dataPoints: diffractionDataPoints,
            marker: {
                type: "circle",
                size: 8
            }
        }]
    });
    canvasjsChart.render();
}