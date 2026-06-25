/** G2 display canvas (576×288). */
export const G2_CANVAS = { width: 576, height: 288 } as const;

export const G2_LAYOUT = {
  status: { x: 8, y: 32, width: 300, height: 248 },
  /** Fixed single-line label — height must be ≥ G2 line height (27px) or it scrolls. */
  vfLabel: { x: 316, y: 4, width: 252, height: 28 },
} as const;

/** Space between "ExEye View Finder" label and the bordered rectangle. */
export const VF_LABEL_GAP = 16;

export const VF_COLUMN = { x: 316, width: 252 } as const;

export const VF_FRAME_PAD = 4;

/** Even Hub ImageContainerProperty limits. */
export const VF_IMAGE_MAX = { width: 244, height: 144 } as const;

export const G2_MODE_PREFIX = "ExEye ·";
export const G2_VF_LABEL = "ExEye View Finder";

export const G2_VF_PLACEHOLDER = "Camera frame appears here when you analyse.";

export const G2_STATUS_WRAP_WIDTH = 30;

export interface ViewfinderLayout {
  frame: { x: number; y: number; width: number; height: number };
  image: { x: number; y: number; width: number; height: number };
}

/** Fit the viewfinder frame and image to the camera aspect ratio within G2 limits. */
export function computeViewfinderLayout(
  imageWidth: number,
  imageHeight: number
): ViewfinderLayout {
  const frameY = G2_LAYOUT.vfLabel.y + G2_LAYOUT.vfLabel.height + VF_LABEL_GAP;
  const maxW = Math.min(VF_COLUMN.width, VF_IMAGE_MAX.width);
  const maxH = Math.min(
    G2_CANVAS.height - frameY - 8,
    VF_IMAGE_MAX.height
  );

  const scale = Math.min(maxW / imageWidth, maxH / imageHeight, 1);
  const imageW = Math.max(20, Math.round(imageWidth * scale));
  const imageH = Math.max(20, Math.round(imageHeight * scale));

  const frameW = imageW + VF_FRAME_PAD * 2;
  const frameH = imageH + VF_FRAME_PAD * 2;
  const frameX = VF_COLUMN.x + Math.floor((VF_COLUMN.width - frameW) / 2);

  return {
    frame: { x: frameX, y: frameY, width: frameW, height: frameH },
    image: {
      x: frameX + VF_FRAME_PAD,
      y: frameY + VF_FRAME_PAD,
      width: imageW,
      height: imageH,
    },
  };
}

export function renderG2LensMarkup(): string {
  return `
    <div class="exeye-lens" id="exeye-screen" data-phase="ready">
      <div class="exeye-lens__status-col">
        <div class="exeye-lens__hdr" id="exeye-g2-hdr">${G2_MODE_PREFIX} Ready</div>
        <div class="exeye-lens__prompt" id="exeye-g2-prompt" hidden></div>
        <div class="exeye-lens__body" id="exeye-g2-body"></div>
      </div>
      <div class="exeye-lens__vf-col">
        <div class="exeye-lens__vf-label">${G2_VF_LABEL}</div>
        <div class="exeye-lens__vf-frame" id="exeye-vf-frame">
          <img id="exeye-vf-image" class="exeye-lens__vf-image" alt="" hidden />
          <p id="exeye-vf-placeholder" class="exeye-lens__vf-placeholder">${G2_VF_PLACEHOLDER}</p>
        </div>
      </div>
    </div>
  `;
}
