import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";

// --- DOM Elements ---
const form = document.getElementById('book-form') as HTMLFormElement;
const themeInput = document.getElementById('theme-input') as HTMLInputElement;
const pagesInput = document.getElementById('pages-input') as HTMLInputElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const btnText = document.querySelector('.btn-text') as HTMLSpanElement;
const spinner = document.querySelector('.spinner') as HTMLDivElement;
const gallery = document.getElementById('gallery') as HTMLDivElement;
const galleryPlaceholder = document.getElementById('gallery-placeholder') as HTMLParagraphElement;
const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;
const downloadControls = document.getElementById('download-controls') as HTMLDivElement;
const downloadPdfBtn = document.getElementById('download-pdf-btn') as HTMLButtonElement;
const downloadJpgsBtn = document.getElementById('download-jpgs-btn') as HTMLButtonElement;

// --- State ---
let isLoading = false;

// --- Gemini AI Setup ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Functions ---
const setLoading = (loading: boolean, message: string = 'Create Book') => {
    isLoading = loading;
    generateBtn.disabled = loading;
    spinner.hidden = !loading;
    btnText.textContent = message;
    if (!loading) {
        btnText.textContent = 'Create Book';
    }
};

const displayError = (message: string) => {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
    galleryPlaceholder.hidden = true;
};

const clearGallery = () => {
    gallery.innerHTML = '';
    errorMessage.hidden = true;
    downloadControls.hidden = true;
};

const displayImage = (imageUrl: string, altText: string, index: number, isCover: boolean = false) => {
    const pageContainer = document.createElement('div');
    pageContainer.className = 'coloring-page';
    if (isCover) {
        pageContainer.classList.add('book-cover');
    }

    const imgElement = document.createElement('img');
    imgElement.src = imageUrl;
    imgElement.alt = altText;

    const downloadLink = document.createElement('a');
    downloadLink.href = imageUrl;
    downloadLink.download = `${themeInput.value.trim().replace(/\s+/g, '_')}_${isCover ? 'cover' : `page_${index}`}.jpg`;
    downloadLink.className = 'download-icon';
    downloadLink.title = "Download JPG";
    downloadLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.586l4.293-4.293a1 1 0 011.414 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 011.414-1.414L12 15.586zM12 4a1 1 0 011 1v9a1 1 0 11-2 0V5a1 1 0 011-1z" /></svg>`;

    pageContainer.appendChild(imgElement);
    pageContainer.appendChild(downloadLink);
    gallery.appendChild(pageContainer);
};

const generateColoringBook = async (theme: string, numPages: number) => {
    setLoading(true, 'Starting...');
    clearGallery();
    galleryPlaceholder.hidden = true;

    try {
        // 1. Generate the Book Cover
        setLoading(true, 'Creating cover...');
        const coverPrompt = `A vibrant and colorful 3D book cover for a children's coloring book. The title is "${theme} Coloring Book". The style is playful, friendly, and appealing to kids aged 3-10.`;
        const coverResponse = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: coverPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '3:4',
            },
        });

        if (coverResponse.generatedImages && coverResponse.generatedImages.length > 0) {
            const base64ImageBytes = coverResponse.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
            displayImage(imageUrl, `Cover for ${theme} coloring book`, 0, true);
        } else {
            throw new Error('Failed to generate the book cover.');
        }

        // 2. Generate Coloring Pages in Batches
        const pagesToGenerate = numPages - 1;
        const batchSize = 4; // API limit
        const coloringPagePrompt = `A black and white coloring book page for a child, thick clean lines, no shading or color. The theme is "${theme}". The page features a fun, friendly, and appealing design with a simple background.`;

        for (let i = 0; i < pagesToGenerate; i += batchSize) {
            const currentBatchSize = Math.min(batchSize, pagesToGenerate - i);
            setLoading(true, `Creating pages ${i + 1}-${i + currentBatchSize}...`);
            
            const pagesResponse = await ai.models.generateImages({
                model: 'imagen-3.0-generate-002',
                prompt: coloringPagePrompt,
                config: {
                    numberOfImages: currentBatchSize,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: '3:4',
                },
            });

            if (pagesResponse.generatedImages && pagesResponse.generatedImages.length > 0) {
                pagesResponse.generatedImages.forEach((image, batchIndex) => {
                    const pageIndex = i + batchIndex + 1;
                    const base64ImageBytes = image.image.imageBytes;
                    const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                    displayImage(imageUrl, `Coloring page for theme "${theme}", page ${pageIndex}`, pageIndex);
                });
            } else {
                 throw new Error(`Failed to generate pages in batch starting at index ${i}.`);
            }
        }
        
        downloadControls.hidden = false;

    } catch (error) {
        console.error(error);
        displayError('An error occurred while creating your coloring book. Please check the console for details and try again.');
    } finally {
        setLoading(false);
    }
};

const downloadAsPdf = async () => {
    const coloringPages = document.querySelectorAll('.coloring-page:not(.book-cover) img') as NodeListOf<HTMLImageElement>;
    if (coloringPages.length === 0) return;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = pageHeight - margin * 2;

    coloringPages.forEach((img, index) => {
        if (index > 0) {
            doc.addPage();
        }
        // The image is added with scaling to fit within the margins
        doc.addImage(img.src, 'JPEG', margin, margin, imgWidth, imgHeight, undefined, 'FAST');
    });

    doc.save(`${themeInput.value.trim().replace(/\s+/g, '_')}_coloring_book.pdf`);
};

const downloadAllJpgs = () => {
    const downloadLinks = document.querySelectorAll('.coloring-page .download-icon') as NodeListOf<HTMLAnchorElement>;
    downloadLinks.forEach((link, index) => {
        setTimeout(() => {
            link.click();
        }, index * 300); // Stagger downloads to avoid browser blocking
    });
};

// --- Event Listeners ---
form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isLoading) return;

    const theme = themeInput.value.trim();
    const numPages = parseInt(pagesInput.value, 10);

    if (theme && numPages > 0) {
        generateColoringBook(theme, numPages);
    } else {
        displayError('Please enter a valid theme and number of pages.');
    }
});

downloadPdfBtn.addEventListener('click', downloadAsPdf);
downloadJpgsBtn.addEventListener('click', downloadAllJpgs);
