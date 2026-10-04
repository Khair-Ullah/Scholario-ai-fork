from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/visa", tags=["visa"])

GUIDES = {
    "Australia": {
        "official_url": "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500",
        "steps": [
            "Confirm your course and enrolment confirmation",
            "Check current student visa subclass requirements",
            "Prepare identity, financial, health, and English evidence requested for your case",
            "Submit through the official online account",
            "Follow visa, study, and work conditions",
        ],
        "documents": [
            "Passport",
            "Confirmation of Enrolment",
            "Financial evidence",
            "Health examination if requested",
            "English evidence if requested",
        ],
    },
    "Canada": {
        "official_url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html",
        "steps": [
            "Confirm whether a study permit is required",
            "Check institution and letter-of-acceptance requirements",
            "Review current financial evidence and biometrics rules",
            "Apply using the official IRCC process",
            "Follow study permit conditions",
        ],
        "documents": [
            "Passport",
            "Letter of acceptance",
            "Proof of funds",
            "Biometrics if requested",
            "Provincial attestation letter if required",
        ],
    },
    "France": {
        "official_url": "https://france-visas.gouv.fr/en/student",
        "steps": [
            "Confirm the correct long-stay student visa category",
            "Complete Campus France steps if applicable",
            "Prepare the application and supporting evidence",
            "Book and attend the appointment required by your location",
            "Follow arrival and residence-registration instructions",
        ],
        "documents": [
            "Passport",
            "Admission evidence",
            "Proof of resources",
            "Accommodation evidence if requested",
            "Application form and photos",
        ],
    },
    "Germany": {
        "official_url": "https://www.auswaertiges-amt.de/en/visa-service/visa-navigator",
        "steps": [
            "Check the German mission responsible for your residence",
            "Confirm the study visa category and appointment process",
            "Prepare admission, financing, health-insurance, and identity evidence",
            "Submit your application and attend the appointment",
            "Complete registration and residence steps after arrival",
        ],
        "documents": [
            "Passport",
            "Admission letter",
            "Financing evidence",
            "Health-insurance evidence",
            "Academic records",
        ],
    },
    "Japan": {
        "official_url": "https://www.mofa.go.jp/j_info/visit/visa/long/visa6.html",
        "steps": [
            "Ask your school about the Certificate of Eligibility process",
            "Check current embassy or consulate requirements",
            "Submit the visa application with requested evidence",
            "Confirm entry conditions when your passport is returned",
            "Complete residence and school procedures after arrival",
        ],
        "documents": [
            "Passport",
            "Visa application",
            "Photo",
            "Certificate of Eligibility if required",
            "Admission and financial documents",
        ],
    },
    "New Zealand": {
        "official_url": "https://www.immigration.govt.nz/new-zealand-visas/visas/visa/student-visa",
        "steps": [
            "Check the right student visa for your course",
            "Confirm offer and provider requirements",
            "Review current funds, insurance, and health requirements",
            "Apply through Immigration New Zealand",
            "Follow visa conditions and arrival instructions",
        ],
        "documents": [
            "Passport",
            "Offer of place",
            "Funds evidence",
            "Insurance evidence",
            "Health and character evidence if requested",
        ],
    },
    "United Kingdom": {
        "official_url": "https://www.gov.uk/student-visa",
        "steps": [
            "Confirm course and Confirmation of Acceptance for Studies",
            "Check current financial and English evidence rules",
            "Apply through the official UK visa process",
            "Complete identity and biometric steps as instructed",
            "Follow work and study conditions",
        ],
        "documents": [
            "Passport",
            "CAS",
            "Financial evidence if required",
            "English evidence if required",
            "ATAS certificate if required",
        ],
    },
    "United States": {
        "official_url": "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
        "steps": [
            "Confirm your institution's SEVP status and receive the school document",
            "Complete the official application and required fees",
            "Schedule and attend the interview if required",
            "Bring academic and financial supporting documents",
            "Follow the terms of your student status",
        ],
        "documents": [
            "Passport",
            "School-issued I-20 or DS-2019",
            "Fee receipts",
            "Application confirmation",
            "Academic and financial evidence",
        ],
    },
}


@router.get("/{country}")
def get_visa_guide(country: str) -> dict:
    guide = GUIDES.get(country)
    if not guide:
        raise HTTPException(status_code=404, detail="No guide is available for this destination yet")
    return {
        "country": country,
        **guide,
        "disclaimer": "Requirements change. Confirm current rules on the linked government site; "
        "this guide is informational, not legal advice.",
    }
