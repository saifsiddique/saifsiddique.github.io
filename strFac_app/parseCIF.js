// parseCIF.js

// Helper functions
function isLetter(character) {
  return /^[A-Za-z]$/.test(character);
}

function isNumber(value) {
  return !Number.isNaN(Number(value)) && Number.isFinite(Number(value));
}

// Function to parse the main sections of the CIF file
export function parseCifInfo(cifInfo) {
  const data = {
    cellParameters: {},
    chemicalComponents: {},
    atomPositions: [],
    spaceGroupName: "N/A"
  };

  // --- Parse Space Group Name ---
  const spaceGroupHMAltMatch = cifInfo.match(/_space_group_name_H-M_alt\s+'([^']+)'/);
  const spaceGroupHallMatch = cifInfo.match(/_space_group_name_Hall\s+'([^']+)'/);

  if (spaceGroupHMAltMatch && spaceGroupHMAltMatch[1]) {
      data.spaceGroupName = spaceGroupHMAltMatch[1].trim();
  } else if (spaceGroupHallMatch && spaceGroupHallMatch[1]) {
      data.spaceGroupName = spaceGroupHallMatch[1].trim();
  } else {
      console.warn("Could not find _space_group_name_H-M_alt or _space_group_name_Hall tag.");
  }


  // --- Parse Chemical Components ---
  const formulaMatch = cifInfo.match(/_chemical_formula_structural\s+'([^']+)'/);
  if (formulaMatch && formulaMatch[1]) {
    const formulaString = formulaMatch[1].trim();
    const elementRegex = /([A-Z][a-z]*)(\d*)/g;
    let match;
    const elementsFound = [];
    while ((match = elementRegex.exec(formulaString)) !== null) {
      elementsFound.push({
        element: match[1],
        number: match[2] ? parseInt(match[2], 10) : 1
      });
    }

    if (elementsFound.length > 0) {
      data.chemicalComponents.element1 = elementsFound[0].element;
      if (elementsFound.length > 1) {
        data.chemicalComponents.element2 = elementsFound[1].element;
      }
    }
  } else {
    console.warn("Could not find _chemical_formula_structural tag. Chemical components might be missing.");
  }


  // --- Parse Cell Parameters ---
  const parseCellParam = (tag) => {
    const match = cifInfo.match(new RegExp(`${tag}\\s*([\\d\\.]+)(?:\\(\\d+\\))?`));
    return match ? parseFloat(match[1]) : undefined;
  };

  data.cellParameters.a = parseCellParam('_cell_length_a');
  data.cellParameters.b = parseCellParam('_cell_length_b');
  data.cellParameters.c = parseCellParam('_cell_length_c');
  data.cellParameters.alpha = parseCellParam('_cell_angle_alpha');
  data.cellParameters.beta = parseCellParam('_cell_angle_beta');
  data.cellParameters.gamma = parseCellParam('_cell_angle_gamma');

  // --- Find Atom Site Loop Start (More Robustly) ---
  let atomSiteLoopStart = -1;
  const cifLines = cifInfo.split('\n'); // Split the whole CIF into lines

  for (let i = 0; i < cifLines.length; i++) {
      const trimmedLine = cifLines[i].trim();
      if (trimmedLine === 'loop_') {
          // Check next few lines for _atom_site_ tag
          for (let j = i + 1; j < Math.min(i + 10, cifLines.length); j++) { // Check up to 10 lines after loop_
              if (cifLines[j].trim().startsWith('_atom_site_')) {
                  atomSiteLoopStart = cifInfo.indexOf('loop_', cifInfo.indexOf(cifLines[i])); // Get precise index of THIS loop_
                  break;
              }
          }
      }
      if (atomSiteLoopStart !== -1) break; // Found the loop, exit outer loop
  }

  // --- Parse Symmetry Operations ---
  const SYMMETRY_TAGS = [
    '_space_group_symop_operation_xyz',
    '_symmetry_equiv_pos_as_xyz'
  ];

  let symmetryLoopStartIndex = -1;
  let foundSymmetryTag = '';
  let symmetryOperations = [];

  // Define the block to search for symmetry operations (from start of file up to atom site loop)
  const potentialSymmetryBlock = cifInfo.substring(0, atomSiteLoopStart !== -1 ? atomSiteLoopStart : cifInfo.length);

  for (const tag of SYMMETRY_TAGS) {
    const symmLoopMatch = potentialSymmetryBlock.match(new RegExp(`loop_\\s*(_[^\\s]+\\s*)*${tag}`));
    if (symmLoopMatch) {
      symmetryLoopStartIndex = cifInfo.indexOf(symmLoopMatch[0]);
      foundSymmetryTag = tag;
      break;
    }
  }

  if (symmetryLoopStartIndex !== -1 && foundSymmetryTag) {
    const symmBlock = cifInfo.substring(symmetryLoopStartIndex, atomSiteLoopStart !== -1 ? atomSiteLoopStart : cifInfo.length);
    const symmLines = symmBlock.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    let symmDataStartsIndex = -1;
    for (let i = 0; i < symmLines.length; i++) {
      if (symmLines[i].includes(foundSymmetryTag)) {
        symmDataStartsIndex = i + 1;
        while (symmDataStartsIndex < symmLines.length && symmLines[symmDataStartsIndex].startsWith('_')) {
             symmDataStartsIndex++;
        }
        break;
      }
    }

    if (symmDataStartsIndex !== -1) {
      for (let i = symmDataStartsIndex; i < symmLines.length; i++) {
        const line = symmLines[i];
        if (line.startsWith('#') || line.startsWith('_') || line.startsWith('loop_') || line.trim() === '') {
          break;
        }
        const parts = line.split(/\s+/).filter(Boolean);
        if (parts.length > 0) {
            let op = '';
            if (parts.length > 1 && !isNaN(Number(parts[0])) && Number.isFinite(Number(parts[0]))) {
                op = parts[1];
            } else {
                op = parts[0];
            }

            if (op.startsWith("'") && op.endsWith("'")) {
                op = op.substring(1, op.length - 1);
            }
            if (op) symmetryOperations.push(op);
        }
      }
    }
  }

  if (symmetryOperations.length === 0) {
    console.warn("No symmetry operations found or parsed from CIF, defaulting to 'x,y,z'.");
    symmetryOperations = ["x,y,z"];
  }
  console.log("Parsed Symmetry Operations:", symmetryOperations);


  // --- Parse Atomic Positions ---
  if (atomSiteLoopStart === -1) {
    console.error("Could not find the 'loop_' for atomic position data containing '_atom_site_' tags. Cannot parse atomic positions.");
    return null;
  }

  const atomSiteBlock = cifInfo.substring(atomSiteLoopStart);
  const lines = atomSiteBlock.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let labels = [];
  let dataStartsIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('_atom_site_')) {
      labels.push(lines[i].substring(lines[i].indexOf('_atom_site_') + '_atom_site_'.length));
    } else if (labels.length > 0 && !lines[i].startsWith('#') && !lines[i].startsWith('loop_') && lines[i].trim() !== '') {
      dataStartsIndex = i;
      break;
    }
  }

  if (dataStartsIndex === -1) {
    console.warn("Could not find start of atomic position data lines after headers for _atom_site_ loop.");
    return null;
  }

  const xIndex = labels.indexOf('fract_x');
  const yIndex = labels.indexOf('fract_y');
  const zIndex = labels.indexOf('fract_z');
  const labelIndex = labels.indexOf('label');

  if (xIndex === -1 || yIndex === -1 || zIndex === -1) {
    console.error("Missing fractional coordinate headers (_atom_site_fract_x,y,z) in atom_site loop. Cannot parse atomic positions.");
    return null;
  }
  if (labelIndex === -1) {
      console.warn("'_atom_site_label' not found. Atom labels might be incorrect.");
  }


  const atomDataLines = lines.slice(dataStartsIndex).filter(line => !line.startsWith('#') && !line.startsWith('_') && !line.startsWith('loop_') && line.trim() !== '');

  if (atomDataLines.length === 0) {
      console.warn("Atom data lines extracted but appear to be empty or only contain comments/tags after filtering.");
      return null;
  }

  for (let i = 0; i < atomDataLines.length; i++) {
    const parts = atomDataLines[i].split(/\s+/).filter(Boolean);

    if (parts.length > Math.max(xIndex, yIndex, zIndex)) {
      let currentAtomLabel = 'Unknown';
      if (labelIndex !== -1 && parts[labelIndex]) {
          currentAtomLabel = parts[labelIndex];
      } else if (parts[0]) {
          currentAtomLabel = parts[0];
      }

      const initialCoords = {
        x: Number(parts[xIndex].split('(')[0]),
        y: Number(parts[yIndex].split('(')[0]),
        z: Number(parts[zIndex].split('(')[0])
      };

      if (isNaN(initialCoords.x) || isNaN(initialCoords.y) || isNaN(initialCoords.z)) {
          console.warn(`Skipping malformed atom line (non-numeric coords): ${atomDataLines[i]}`);
          continue;
      }

      let actualElementType = currentAtomLabel.match(/([A-Z][a-z]*)/);
      actualElementType = actualElementType ? actualElementType[1] : 'Unknown';

      if (actualElementType === 'Unknown') {
          if (data.chemicalComponents.element1 && currentAtomLabel.includes(data.chemicalComponents.element1)) {
              actualElementType = data.chemicalComponents.element1;
          } else if (data.chemicalComponents.element2 && currentAtomLabel.includes(data.chemicalComponents.element2)) {
              actualElementType = data.chemicalComponents.element2;
          }
      }


      symmetryOperations.forEach(opString => {
        let x_new, y_new, z_new;
        try {
            // mathjs is loaded globally in index.html, so it should be available here
            const scope = { x: initialCoords.x, y: initialCoords.y, z: initialCoords.z };
            const ops = opString.split(',').map(s => s.trim());

            x_new = math.evaluate(ops[0], scope);
            y_new = math.evaluate(ops[1], scope);
            z_new = math.evaluate(ops[2], scope);

        } catch (e) {
            console.error(`Error evaluating symmetry operation '${opString}' for atom ${currentAtomLabel}:`, e);
            return;
        }

        x_new = (x_new % 1 + 1) % 1; // Ensure 0 <= x < 1
        y_new = (y_new % 1 + 1) % 1; // Ensure 0 <= y < 1
        z_new = (z_new % 1 + 1) % 1; // Ensure 0 <= z < 1

        data.atomPositions.push({
          x: x_new,
          y: y_new,
          z: z_new,
          label: actualElementType
        });
      });
    } else {
        console.warn(`Skipping malformed atom line (not enough parts): ${atomDataLines[i]}`);
    }
  }

  return data;
}