"""
Indian Legal Document Templates
Complete, legally-structured templates used as RAG seeds and generation scaffolds.
Each template uses {PLACEHOLDER} variables for dynamic fields.
"""

from __future__ import annotations

# ─────────────────────────────────────────────────────────────────────────────
# 1. STANDARD 11-MONTH RENTAL / LEASE AGREEMENT – BANGALORE FORMAT
# ─────────────────────────────────────────────────────────────────────────────

RENT_AGREEMENT_TEMPLATE = """
RESIDENTIAL RENTAL / LEASE AGREEMENT

(To be executed on Non-Judicial Stamp Paper of appropriate value as per
the Karnataka Stamp Act, 1957 – currently ₹500 for 11-month agreements)

──────────────────────────────────────────────────────────────────────────
This RENTAL AGREEMENT ("Agreement") is executed on this {EXECUTION_DATE}
at {CITY}, {STATE}, India.

BETWEEN

{LANDLORD_NAME}, {LANDLORD_RELATION} {LANDLORD_PARENT_NAME},
aged about {LANDLORD_AGE} years, residing at {LANDLORD_ADDRESS},
PAN: {LANDLORD_PAN}, Aadhaar: {LANDLORD_AADHAAR}
(hereinafter referred to as the "LESSOR/LANDLORD", which expression
shall, unless the context otherwise requires, include their heirs,
executors, administrators, legal representatives and assigns of the
FIRST PART)

AND

{TENANT_NAME}, {TENANT_RELATION} {TENANT_PARENT_NAME},
aged about {TENANT_AGE} years, residing at {TENANT_ADDRESS},
PAN: {TENANT_PAN}, Aadhaar: {TENANT_AADHAAR}
(hereinafter referred to as the "LESSEE/TENANT", which expression
shall, unless the context otherwise requires, include their heirs,
executors, administrators, legal representatives and assigns of the
SECOND PART)

WHEREAS the Lessor is the absolute and lawful owner of the property
described herein and is desirous of letting out the same, and the
Lessee is desirous of taking the same on rent;

NOW THEREFORE, in consideration of the mutual covenants and
agreements herein, the parties agree as follows:

1. DESCRIPTION OF PREMISES
   The Lessor hereby lets out and the Lessee takes on rent the
   residential premises described as:
   Address: {PROPERTY_ADDRESS}
   Area: {PROPERTY_AREA} sq. ft. (approximately)
   Floor: {FLOOR_NUMBER}
   Comprising: {ROOMS_DESCRIPTION}
   Amenities: {AMENITIES}
   (hereinafter referred to as the "Scheduled Premises")

2. TERM OF TENANCY
   2.1. This Agreement shall commence on {START_DATE} and shall
        expire on {END_DATE}, a period of ELEVEN (11) MONTHS.
   2.2. This Agreement is NOT renewable automatically. Any extension
        shall require a fresh written agreement executed on
        appropriate stamp paper.
   2.3. Upon expiry, the Lessee shall peacefully vacate and hand
        over vacant possession of the Scheduled Premises.

3. RENT AND PAYMENT
   3.1. The monthly rent shall be ₹{MONTHLY_RENT}/- (Rupees
        {MONTHLY_RENT_WORDS} only), payable on or before the
        {RENT_DUE_DAY}th of each calendar month.
   3.2. Rent shall be paid via {PAYMENT_MODE} to the Lessor's
        designated bank account.
   3.3. A late payment surcharge of ₹{LATE_FEE}/- per day shall
        apply for payments delayed beyond 7 days from the due date.
   3.4. The Lessor reserves the right to revise the rent by a
        maximum of {RENT_ESCALATION}% upon execution of a fresh
        agreement after the expiry of this term.

4. SECURITY DEPOSIT
   4.1. The Lessee has paid a refundable security deposit of
        ₹{SECURITY_DEPOSIT}/- (Rupees {SECURITY_DEPOSIT_WORDS}
        only) to the Lessor, receipt of which is hereby
        acknowledged.
   4.2. The security deposit shall carry NO interest.
   4.3. The deposit shall be refunded within 30 days of vacating,
        after deducting:
        (a) unpaid rent or utility bills;
        (b) cost of repairs for damages beyond normal wear and tear;
        (c) any other dues payable by the Lessee under this Agreement.
   4.4. The Lessee shall NOT adjust the security deposit against
        rent for any month.

5. MAINTENANCE AND UTILITIES
   5.1. Electricity, water, gas, internet, and DTH charges shall be
        borne entirely by the Lessee based on actual consumption.
   5.2. Association/society maintenance charges of ₹{MAINTENANCE_CHARGE}/-
        per month shall be borne by the {MAINTENANCE_PAYER}.
   5.3. Minor repairs up to ₹{MINOR_REPAIR_LIMIT}/- per instance
        shall be borne by the Lessee; structural and major repairs
        shall be the Lessor's responsibility.

6. USE OF PREMISES
   6.1. The Scheduled Premises shall be used SOLELY for residential
        purposes by the Lessee and their immediate family.
   6.2. The Lessee shall NOT carry on any commercial, illegal, or
        immoral activities in the premises.
   6.3. The Lessee shall NOT sub-let, assign, or part with
        possession of the premises or any part thereof.
   6.4. The Lessee shall NOT make any structural alterations or
        additions without the prior written consent of the Lessor.
   6.5. The Lessee shall maintain the premises in good and tenantable
        condition and shall not cause any nuisance or annoyance.

7. TERMINATION AND NOTICE
   7.1. Either party may terminate this Agreement by giving
        {NOTICE_PERIOD} months' prior written notice to the other
        party.
   7.2. The Lessor may terminate immediately if:
        (a) rent is in arrears for more than 2 consecutive months;
        (b) the Lessee breaches any material term of this Agreement;
        (c) the Lessee uses the premises for illegal purposes.
   7.3. Upon termination, the Lessee shall vacate and deliver
        vacant, peaceful possession along with all keys.

8. INSPECTION AND ACCESS
   The Lessor or their authorized representative may inspect the
   premises upon giving 24 hours' prior notice, at a mutually
   convenient time during reasonable hours.

9. INDEMNIFICATION
   The Lessee shall indemnify and hold harmless the Lessor against
   all claims, damages, losses, costs, and expenses arising from the
   Lessee's use of the Scheduled Premises or breach of this Agreement.

10. FORCE MAJEURE
    Neither party shall be liable for any failure or delay in
    performance due to causes beyond their reasonable control,
    including but not limited to natural disasters, pandemics,
    government orders, war, or civil unrest. If a force majeure event
    continues for more than 60 consecutive days, either party may
    terminate this Agreement without penalty.

11. GOVERNING LAW AND JURISDICTION
    11.1. This Agreement shall be governed by and construed in
          accordance with the laws of India, including the
          Indian Contract Act, 1872, the Transfer of Property Act,
          1882, and the Karnataka Rent Control Act (as applicable).
    11.2. Any disputes arising out of or in connection with this
          Agreement shall be subject to the exclusive jurisdiction
          of the courts in {CITY}, {STATE}.

12. DISPUTE RESOLUTION
    12.1. The parties shall first attempt to resolve any dispute
          through mutual negotiation within 30 days.
    12.2. Failing negotiation, the dispute shall be referred to a
          sole arbitrator mutually appointed under the Arbitration
          and Conciliation Act, 1996. The seat of arbitration shall
          be {CITY}.
    12.3. The language of arbitration shall be English.

13. GENERAL PROVISIONS
    13.1. This Agreement constitutes the entire understanding
          between the parties and supersedes all prior negotiations.
    13.2. No modification shall be valid unless in writing and
          signed by both parties.
    13.3. If any provision is held invalid, the remaining provisions
          shall continue in full force.
    13.4. Notices shall be in writing and delivered to the addresses
          mentioned above or as updated in writing.

IN WITNESS WHEREOF, the parties have set their hands on this
Agreement on the date first above written.

LESSOR / LANDLORD                     LESSEE / TENANT
Name: {LANDLORD_NAME}                Name: {TENANT_NAME}
Signature: _______________           Signature: _______________

WITNESSES:
1. Name: _______________   Signature: _______________
   Address: _______________

2. Name: _______________   Signature: _______________
   Address: _______________
"""


# ─────────────────────────────────────────────────────────────────────────────
# 2. NON-DISCLOSURE AGREEMENT (NDA) – INDIAN FORMAT
# ─────────────────────────────────────────────────────────────────────────────

NDA_TEMPLATE = """
NON-DISCLOSURE AGREEMENT

(To be executed on Non-Judicial Stamp Paper of appropriate value
as per the applicable State Stamp Act)

──────────────────────────────────────────────────────────────────────────
This NON-DISCLOSURE AGREEMENT ("Agreement") is entered into on this
{EXECUTION_DATE} at {CITY}, {STATE}, India.

BETWEEN

{DISCLOSER_NAME}, a {DISCLOSER_ENTITY_TYPE} incorporated/registered
under the laws of India, having its registered office at
{DISCLOSER_ADDRESS}, represented by {DISCLOSER_REPRESENTATIVE},
{DISCLOSER_DESIGNATION}
(hereinafter referred to as the "Disclosing Party")

AND

{RECIPIENT_NAME}, a {RECIPIENT_ENTITY_TYPE} incorporated/registered
under the laws of India, having its registered office at
{RECIPIENT_ADDRESS}, represented by {RECIPIENT_REPRESENTATIVE},
{RECIPIENT_DESIGNATION}
(hereinafter referred to as the "Receiving Party")

(The Disclosing Party and the Receiving Party are individually referred
to as a "Party" and collectively as the "Parties".)

RECITALS

WHEREAS the Disclosing Party possesses certain proprietary and
confidential information relating to {PURPOSE_DESCRIPTION}; and

WHEREAS the Receiving Party desires to receive such confidential
information solely for the purpose of {PURPOSE_OF_DISCLOSURE}
("Permitted Purpose"); and

WHEREAS the Parties wish to protect the confidentiality of such
information;

NOW THEREFORE, in consideration of the mutual promises herein and
other good and valuable consideration, the Parties agree as follows:

1. DEFINITION OF CONFIDENTIAL INFORMATION
   1.1. "Confidential Information" means all information, whether
        oral, written, electronic, visual, or in any other form,
        disclosed by the Disclosing Party to the Receiving Party,
        including but not limited to:
        (a) business plans, strategies, financial data, projections;
        (b) trade secrets, know-how, inventions, processes, methods;
        (c) technical data, designs, algorithms, source code;
        (d) customer lists, vendor information, pricing;
        (e) marketing plans, product roadmaps;
        (f) any other information marked or identified as
            "Confidential" or that a reasonable person would
            understand to be confidential.
   1.2. Confidential Information shall NOT include information that:
        (a) is or becomes publicly available through no fault of
            the Receiving Party;
        (b) was already known to the Receiving Party prior to
            disclosure, as evidenced by written records;
        (c) is independently developed by the Receiving Party
            without use of or reference to the Confidential
            Information;
        (d) is received from a third party without obligation of
            confidentiality;
        (e) is required to be disclosed by law, regulation, or
            court order, provided the Receiving Party gives prompt
            written notice to the Disclosing Party.

2. OBLIGATIONS OF THE RECEIVING PARTY
   2.1. The Receiving Party shall:
        (a) hold all Confidential Information in strict confidence;
        (b) use Confidential Information solely for the Permitted
            Purpose;
        (c) restrict disclosure to employees, directors, advisors,
            and consultants ("Authorized Representatives") who have
            a legitimate need to know and are bound by obligations
            of confidentiality no less restrictive than this
            Agreement;
        (d) exercise at least the same degree of care as it uses to
            protect its own confidential information, but in no
            event less than reasonable care;
        (e) not reverse-engineer, decompile, or disassemble any
            Confidential Information.
   2.2. The Receiving Party shall be responsible for any breach by
        its Authorized Representatives.

3. TERM AND DURATION
   3.1. This Agreement shall be effective from the date first written
        above and shall continue for a period of {TERM_YEARS}
        year(s), unless terminated earlier.
   3.2. The confidentiality obligations shall survive the termination
        or expiry of this Agreement for a further period of
        {SURVIVAL_YEARS} year(s).

4. RETURN AND DESTRUCTION OF INFORMATION
   Upon termination, expiry, or written request by the Disclosing
   Party, the Receiving Party shall within {RETURN_DAYS} days:
   (a) return all tangible materials containing Confidential
       Information;
   (b) permanently delete or destroy all copies, notes, summaries,
       and derivatives in any form;
   (c) provide a written certification of compliance signed by an
       authorized officer.

5. INTELLECTUAL PROPERTY
   5.1. No license, right, or interest in any intellectual property
        of the Disclosing Party is granted by this Agreement.
   5.2. All Confidential Information remains the exclusive property
        of the Disclosing Party.

6. REMEDIES
   6.1. The Receiving Party acknowledges that unauthorized disclosure
        may cause irreparable harm for which monetary damages may be
        inadequate.
   6.2. The Disclosing Party shall be entitled to seek injunctive
        relief in addition to any other remedies available at law
        or in equity.
   6.3. The Receiving Party shall pay liquidated damages of
        ₹{LIQUIDATED_DAMAGES}/- for each proven breach, without
        prejudice to the Disclosing Party's right to claim actual
        damages.

7. NON-SOLICITATION
   During the term of this Agreement and for {NON_SOLICIT_MONTHS}
   months thereafter, neither Party shall directly or indirectly
   solicit or hire any employee of the other Party without prior
   written consent.

8. INDEMNIFICATION
   The Receiving Party shall indemnify, defend, and hold harmless the
   Disclosing Party from all losses, damages, liabilities, costs,
   and expenses (including reasonable attorney fees) arising from any
   breach of this Agreement by the Receiving Party or its Authorized
   Representatives.

9. NO WARRANTY
   All Confidential Information is provided "AS IS". The Disclosing
   Party makes no warranty regarding the accuracy, completeness, or
   fitness for any purpose of the Confidential Information.

10. FORCE MAJEURE
    Neither Party shall be liable for delays caused by circumstances
    beyond their reasonable control, including natural disasters,
    pandemics, government actions, or civil unrest.

11. GOVERNING LAW AND JURISDICTION
    11.1. This Agreement shall be governed by the laws of India,
          including the Indian Contract Act, 1872, the Information
          Technology Act, 2000, and the Trade Secrets (Protection)
          framework.
    11.2. Any disputes shall be subject to the exclusive
          jurisdiction of the courts in {CITY}, {STATE}.

12. DISPUTE RESOLUTION
    12.1. Disputes shall first be resolved through good-faith
          negotiation within 30 days.
    12.2. Unresolved disputes shall be referred to binding
          arbitration under the Arbitration and Conciliation Act,
          1996, before a sole arbitrator in {CITY}.

13. GENERAL PROVISIONS
    13.1. This Agreement constitutes the entire agreement between the
          Parties on this subject matter.
    13.2. Amendments must be in writing signed by both Parties.
    13.3. Neither Party may assign this Agreement without prior
          written consent.
    13.4. The invalidity of any provision shall not affect the
          remaining provisions.
    13.5. No waiver of any breach shall constitute a waiver of any
          subsequent breach.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of
the date first above written.

DISCLOSING PARTY                      RECEIVING PARTY
Name: {DISCLOSER_REPRESENTATIVE}     Name: {RECIPIENT_REPRESENTATIVE}
Designation: {DISCLOSER_DESIGNATION}  Designation: {RECIPIENT_DESIGNATION}
Signature: _______________           Signature: _______________

WITNESSES:
1. Name: _______________   Signature: _______________
2. Name: _______________   Signature: _______________
"""


# ─────────────────────────────────────────────────────────────────────────────
# 3. FREELANCE / SERVICE CONTRACT – INDIAN FORMAT
# ─────────────────────────────────────────────────────────────────────────────

FREELANCE_CONTRACT_TEMPLATE = """
FREELANCE / INDEPENDENT CONTRACTOR SERVICE AGREEMENT

(To be executed on Non-Judicial Stamp Paper of appropriate value
as per the applicable State Stamp Act)

──────────────────────────────────────────────────────────────────────────
This SERVICE AGREEMENT ("Agreement") is entered into on {EXECUTION_DATE}
at {CITY}, {STATE}, India.

BETWEEN

{CLIENT_NAME}, a {CLIENT_ENTITY_TYPE} having its registered office at
{CLIENT_ADDRESS}, PAN: {CLIENT_PAN}, GSTIN: {CLIENT_GSTIN},
represented by {CLIENT_REPRESENTATIVE}, {CLIENT_DESIGNATION}
(hereinafter referred to as the "Client")

AND

{FREELANCER_NAME}, an individual / sole proprietor,
residing at {FREELANCER_ADDRESS},
PAN: {FREELANCER_PAN}, GSTIN: {FREELANCER_GSTIN} (if applicable),
Aadhaar: {FREELANCER_AADHAAR}
(hereinafter referred to as the "Contractor")

RECITALS

WHEREAS the Client requires certain professional services as
described herein; and WHEREAS the Contractor possesses the
necessary skills and expertise to perform such services; and
WHEREAS the Parties wish to define the terms of their engagement;

NOW THEREFORE, the Parties agree as follows:

1. SCOPE OF SERVICES
   1.1. The Contractor shall perform the services described in
        Schedule A ("Services") attached hereto and incorporated
        by reference.
   1.2. Summary of Services: {SERVICES_DESCRIPTION}
   1.3. Deliverables: {DELIVERABLES}
   1.4. The Contractor shall perform the Services in a professional
        and workmanlike manner, in accordance with industry standards.

2. TERM
   2.1. This Agreement commences on {START_DATE} and shall continue
        until {END_DATE}, unless terminated earlier in accordance
        with Clause 9.
   2.2. The term may be extended by mutual written agreement.

3. COMPENSATION AND PAYMENT
   3.1. The Client shall pay the Contractor a total fee of
        ₹{TOTAL_FEE}/- (Rupees {TOTAL_FEE_WORDS} only),
        payable as follows:
        (a) {ADVANCE_PERCENT}% advance upon signing: ₹{ADVANCE_AMOUNT}/-
        (b) {MILESTONE_SCHEDULE}
        (c) Final payment within {FINAL_PAYMENT_DAYS} days of
            satisfactory completion and acceptance of all Deliverables.
   3.2. All payments shall be made via {PAYMENT_MODE} to the
        Contractor's bank account.
   3.3. Invoices shall be raised by the Contractor with valid GST
        details (if applicable). The Client shall make payment
        within {PAYMENT_TERMS} days of receiving a valid invoice.
   3.4. Late payments shall attract interest at {LATE_INTEREST}%
        per annum, calculated from the due date.
   3.5. TDS shall be deducted at source as per applicable provisions
        of the Income Tax Act, 1961. The Client shall provide TDS
        certificates (Form 16A) within the prescribed timelines.

4. INDEPENDENT CONTRACTOR STATUS
   4.1. The Contractor is an independent contractor and NOT an
        employee, agent, partner, or joint venturer of the Client.
   4.2. The Contractor shall be solely responsible for:
        (a) their own income tax filings and payments;
        (b) GST registrations and filings (if applicable);
        (c) professional tax, insurance, and other statutory
            obligations;
        (d) their own tools, equipment, and workspace.
   4.3. The Client shall not provide employee benefits (PF, ESI,
        gratuity, leave) to the Contractor.
   4.4. The Contractor shall have the freedom to determine the
        manner and means of performing the Services, subject to
        the Deliverables and timelines agreed upon.

5. INTELLECTUAL PROPERTY
   5.1. All work product, deliverables, code, designs, documents,
        and materials created by the Contractor in the course of
        performing the Services ("Work Product") shall be the
        exclusive property of the Client upon full payment.
   5.2. The Contractor hereby assigns all rights, title, and
        interest (including copyright, patent rights, and other
        intellectual property rights) in the Work Product to the
        Client, in perpetuity, worldwide.
   5.3. The Contractor retains the right to use general skills,
        knowledge, and experience gained during the engagement,
        and any pre-existing intellectual property owned by the
        Contractor ("Contractor IP"). Any Contractor IP incorporated
        into the Work Product shall be licensed to the Client on a
        non-exclusive, perpetual, royalty-free basis.
   5.4. The Contractor shall execute any further documents necessary
        to perfect the Client's ownership of the Work Product.

6. CONFIDENTIALITY
   6.1. The Contractor shall maintain strict confidentiality of all
        information, data, and materials provided by the Client.
   6.2. Confidential information shall not be disclosed to any third
        party without prior written consent of the Client.
   6.3. This obligation survives termination of this Agreement for
        a period of {CONFIDENTIALITY_YEARS} year(s).

7. NON-COMPETE AND NON-SOLICITATION
   7.1. During the term and for {NON_COMPETE_MONTHS} months
        thereafter, the Contractor shall not directly provide
        substantially similar services to {COMPETITOR_DESCRIPTION}.
   7.2. Neither Party shall solicit or hire the other Party's
        employees during the term and for 12 months thereafter.
   NOTE: The enforceability of non-compete clauses in India is
   limited under Section 27 of the Indian Contract Act, 1872.
   This clause is intended to be reasonably restrictive.

8. WARRANTIES AND REPRESENTATIONS
   8.1. The Contractor warrants that:
        (a) they have the right and authority to enter into this
            Agreement;
        (b) the Services shall be performed with due skill and care;
        (c) the Work Product shall be original and shall not
            infringe any third-party intellectual property rights;
        (d) they are not bound by any agreement that conflicts with
            this Agreement.
   8.2. The Contractor shall, at their own expense, rectify any
        defects in the Deliverables reported within {WARRANTY_DAYS}
        days of acceptance.

9. TERMINATION
   9.1. Either Party may terminate this Agreement by giving
        {NOTICE_PERIOD} days' prior written notice.
   9.2. The Client may terminate immediately if the Contractor:
        (a) commits a material breach that is not cured within
            15 days of written notice;
        (b) becomes insolvent or bankrupt;
        (c) fails to meet agreed milestones without valid reason.
   9.3. Upon termination:
        (a) the Contractor shall deliver all completed and
            in-progress Work Product;
        (b) the Client shall pay for Services satisfactorily
            rendered up to the date of termination;
        (c) any advance paid for unperformed Services shall be
            refunded within 15 days.

10. LIMITATION OF LIABILITY
    10.1. The Contractor's total aggregate liability under this
          Agreement shall not exceed the total fees paid or payable
          under this Agreement.
    10.2. Neither Party shall be liable for indirect, incidental,
          consequential, or punitive damages.
    10.3. This limitation shall not apply to breaches of
          confidentiality or intellectual property obligations.

11. INDEMNIFICATION
    11.1. The Contractor shall indemnify the Client against any
          third-party claims arising from:
          (a) infringement of intellectual property rights;
          (b) negligence or wilful misconduct of the Contractor;
          (c) breach of any warranty under this Agreement.
    11.2. The Client shall indemnify the Contractor against claims
          arising from the Client's use of the Work Product in a
          manner not contemplated by this Agreement.

12. FORCE MAJEURE
    Neither Party shall be liable for delays caused by events beyond
    reasonable control (natural disasters, pandemics, government
    orders, strikes, war). If force majeure continues for more than
    30 days, either Party may terminate without penalty.

13. GOVERNING LAW AND DISPUTE RESOLUTION
    13.1. This Agreement is governed by the laws of India, including
          the Indian Contract Act, 1872.
    13.2. Disputes shall be resolved through:
          (a) Good-faith negotiation (30 days);
          (b) Mediation under the Mediation Act, 2023 (if applicable);
          (c) Binding arbitration under the Arbitration and
              Conciliation Act, 1996, before a sole arbitrator in
              {CITY}. The language of arbitration shall be English.
    13.3. Courts in {CITY}, {STATE} shall have exclusive jurisdiction.

14. GENERAL PROVISIONS
    14.1. Entire Agreement: This Agreement supersedes all prior
          discussions and agreements.
    14.2. Amendments: Must be in writing signed by both Parties.
    14.3. Severability: Invalid provisions shall not affect the
          remainder.
    14.4. Waiver: No waiver of any term shall constitute a
          continuing waiver.
    14.5. Assignment: The Contractor may not assign without written
          consent. The Client may assign to affiliates.
    14.6. Notices: In writing, delivered to addresses above.
    14.7. Counterparts: May be executed in counterparts.

IN WITNESS WHEREOF, the Parties have executed this Agreement.

CLIENT                                CONTRACTOR
Name: {CLIENT_REPRESENTATIVE}        Name: {FREELANCER_NAME}
Designation: {CLIENT_DESIGNATION}
Signature: _______________           Signature: _______________
Date: {EXECUTION_DATE}               Date: {EXECUTION_DATE}

WITNESSES:
1. Name: _______________   Signature: _______________
2. Name: _______________   Signature: _______________

──────────────────────────────────────────────────────────────────────────
SCHEDULE A – SCOPE OF SERVICES AND DELIVERABLES

1. Services: {DETAILED_SERVICES}
2. Deliverables: {DETAILED_DELIVERABLES}
3. Milestones and Timeline:
   {MILESTONE_TABLE}
4. Acceptance Criteria: {ACCEPTANCE_CRITERIA}
"""


# ── Template Registry ─────────────────────────────────────────────────────────

TEMPLATES = {
    "rent_agreement": {
        "title": "Standard 11-Month Residential Rental Agreement (Karnataka)",
        "description": (
            "Comprehensive rental/lease agreement following the Bangalore format, "
            "suitable for Karnataka and adaptable to other Indian states. Includes "
            "clauses on security deposit, maintenance, termination, force majeure, "
            "and dispute resolution via arbitration."
        ),
        "template": RENT_AGREEMENT_TEMPLATE,
        "sample_fields": [
            "LANDLORD_NAME", "TENANT_NAME", "PROPERTY_ADDRESS",
            "MONTHLY_RENT", "SECURITY_DEPOSIT", "START_DATE", "END_DATE",
        ],
    },
    "nda": {
        "title": "Non-Disclosure Agreement (Indian Format)",
        "description": (
            "Bilateral or unilateral NDA suitable for Indian businesses. Covers "
            "definition of confidential information, obligations, IP protection, "
            "remedies including liquidated damages, non-solicitation, and dispute "
            "resolution."
        ),
        "template": NDA_TEMPLATE,
        "sample_fields": [
            "DISCLOSER_NAME", "RECIPIENT_NAME", "PURPOSE_DESCRIPTION",
            "TERM_YEARS", "LIQUIDATED_DAMAGES", "CITY",
        ],
    },
    "freelance_contract": {
        "title": "Freelance / Independent Contractor Service Agreement (Indian Format)",
        "description": (
            "Comprehensive freelance/service contract covering scope of work, "
            "payment with TDS provisions, IP assignment, independent contractor "
            "status, warranties, limitation of liability, and Indian dispute "
            "resolution."
        ),
        "template": FREELANCE_CONTRACT_TEMPLATE,
        "sample_fields": [
            "CLIENT_NAME", "FREELANCER_NAME", "SERVICES_DESCRIPTION",
            "TOTAL_FEE", "START_DATE", "END_DATE", "CITY",
        ],
    },
}
