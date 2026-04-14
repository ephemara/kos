import { invoke } from '../core/bridge.js';

let containerEl;

export async function mount(container) {
    console.log('🤖 AUTOPBR: Mounting...');
    containerEl = container;

    // 1. Inject UI
    injectUI();
}

export function unmount() {
    console.log('🤖 AUTOPBR: Unmounting...');
    if (containerEl) {
        containerEl.innerHTML = '';
        containerEl.classList.remove('autopbr-mode');
    }
}

function injectUI() {
    // Main View
    containerEl.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#888;">
            <div style="background:#1a1a1a; padding:40px; border-radius:20px; border:1px solid #333; width:600px; text-align:center;">
                <h1 style="color:white; margin-bottom:10px;">AutoPBR (AI Texture Gen)</h1>
                <p>Describe your material (e.g. "Rusted metal with scratches")</p>
                
                <textarea id="autopbr-prompt" 
                    style="width:100%; height:100px; background:#111; color:white; border:1px solid #444; margin:20px 0; padding:10px; border-radius:8px;"
                ></textarea>
                
                <button id="btn-generate" 
                    style="background:linear-gradient(135deg, #f97316, #ea580c); color:white; border:none; padding:10px 40px; border-radius:8px; font-weight:bold; cursor:pointer;"
                >
                    GENERATE (Costs Credits)
                </button>
                
                <div id="gen-status" style="margin-top:20px; font-size:12px; color:#666;">Ready</div>
            </div>

            <!-- Results Preview Grid -->
            <div id="results-grid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-top:40px; width:800px;">
                <!-- Result Cards Injected Here -->
            </div>
        </div>
    `;

    // Bind
    document.getElementById('btn-generate').onclick = async () => {
        const prompt = document.getElementById('autopbr-prompt').value;
        if (!prompt) return;

        const status = document.getElementById('gen-status');
        status.innerText = 'Connecting to AI backend...';

        // Mock Generation
        await new Promise(r => setTimeout(r, 1000));
        status.innerText = 'Generating Maps (Diffuse, Normal, Roughness)...';
        await new Promise(r => setTimeout(r, 2000));

        status.innerText = 'Generation Complete.';
        addResultCard();
    };
}

function addResultCard() {
    const grid = document.getElementById('results-grid');
    const card = document.createElement('div');
    card.style.cssText = `
        background: #222; border: 1px solid #444; aspect-ratio: 1; border-radius: 8px;
        display: flex; align-items: center; justify-content: center; font-size: 10px; color: #666;
    `;
    card.innerText = "PREVIEW";
    grid.appendChild(card);
}
