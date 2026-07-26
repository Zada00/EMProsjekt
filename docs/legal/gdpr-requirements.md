# Legal & Privacy Requirements – Property Document AI (Norway / EEA)

> Reference document as provided. See `gdpr-gap-analysis.md` in this same folder
> for how BoligCopilot currently maps against each point below, and what is
> still open.

## Scope

This application accepts uploaded property documents (for example tilstandsrapporter and salgsoppgaver), sends them to Anthropic Claude through the API for analysis, and returns structured findings to the user.

The application may process personal data.

The primary legislation is:

* Regulation (EU) 2016/679 (GDPR)
* Norwegian Personal Data Act (Personopplysningsloven), which incorporates GDPR into Norwegian law.

Official sources:

GDPR (EUR-Lex)
https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679

Norwegian Personal Data Act (Lovdata)
https://lovdata.no/dokument/NL/lov/2018-06-15-38

---

# Core Principle

Even if uploaded PDFs are never permanently stored, the application still processes personal data.

Under GDPR, "processing" includes:

* collection
* upload
* transmission
* consultation
* analysis
* deletion

Not storing uploaded files reduces risk, but it does **not** remove GDPR obligations.

(GDPR Article 4)

---

# GDPR Requirements

## Article 5 — Principles relating to processing

The application must follow these principles:

* lawfulness
* fairness
* transparency
* purpose limitation
* data minimisation
* accuracy
* storage limitation
* integrity and confidentiality
* accountability

Implementation:

* process only information necessary to perform the requested analysis
* avoid unnecessary logging
* do not reuse uploaded documents for unrelated purposes
* delete temporary processing data when no longer needed
* secure the processing pipeline

Status:

**Legal requirement**

---

## Article 6 — Lawful basis

A lawful basis must exist before processing personal data.

For this application, the most likely lawful basis is:

Article 6(1)(b)

Processing is necessary to provide the service requested by the user.

Do not assume consent is automatically the correct lawful basis.

Status:

**Legal requirement**

---

## Articles 13 & 14 — Information obligations

Users must receive clear information about:

* who operates the service
* why documents are processed
* which personal data is processed
* whether third parties receive data
* whether data leaves the EEA
* retention periods
* user rights
* contact information

This is normally implemented through a Privacy Policy.

Status:

**Legal requirement**

---

## Article 24 — Responsibility of the controller

The organisation must be able to demonstrate GDPR compliance.

Maintain internal documentation describing:

* system architecture
* data flow
* processors
* security measures
* retention policy

Status:

**Legal requirement**

---

## Article 25 — Data Protection by Design and by Default

Privacy should be built into the architecture.

Recommended implementation:

* backend proxy
* process files in memory
* minimise logging
* least privilege
* secure defaults

Status:

**Legal requirement**

(The exact technical implementation is flexible.)

---

## Article 28 — Processor

If Anthropic processes personal data on your behalf, it will generally act as a processor for that processing activity.

Before production:

* determine whether Anthropic acts as a processor for your use case
* review Anthropic's Data Processing Agreement (DPA)
* execute a DPA if required

Do not assume a DPA is optional.

Status:

**Legal requirement where a processor relationship exists**

---

## Article 30 — Records of Processing Activities

Maintain an internal description of:

* categories of data
* purpose
* recipients
* retention
* security

Small organisations may qualify for exemptions from the formal record-keeping obligation under certain circumstances (Article 30(5)), but maintaining a record is still considered good practice and makes compliance much easier.

Status:

**Legal requirement in many cases**

**Recommended regardless of exemption**

---

## Article 32 — Security of processing

Implement appropriate technical and organisational security measures.

Examples:

* HTTPS
* secure API keys
* backend-only secrets
* dependency management
* access controls
* safe logging
* production error handling

GDPR does not prescribe specific technologies.

Status:

**Legal requirement**

---

## Articles 44–49 — International Transfers

If personal data is transferred outside the EEA, a valid transfer mechanism must exist.

Determine:

* where Anthropic processes API requests
* which transfer mechanism applies
* document this in the Privacy Policy

Status:

**Legal requirement if international transfers occur**

---

# Anthropic

Before production, review the official Anthropic documentation regarding:

* API Terms
* Privacy
* Data Processing Agreement
* Data Retention

Current Anthropic documentation states:

* API data is not used to train models by default.
* Standard API requests are generally retained for up to 30 days.
* Zero Data Retention is available only for eligible customers and supported API features.

Never make stronger privacy claims than your provider actually guarantees.

Official sources:

https://platform.claude.com/docs/en/manage-claude/api-and-data-retention

https://privacy.claude.com/

---

# Logging Policy

Never log:

* uploaded PDFs
* extracted text
* prompts
* model responses
* names
* addresses
* phone numbers
* signatures

Safe operational logs include:

* request ID
* timestamp
* latency
* provider
* model
* token counts
* estimated cost
* success / failure

Status:

**Recommended best practice**

(Not explicitly required by GDPR, but strongly supports Articles 5 and 32.)

---

# Storage Policy

Preferred architecture:

User

↓

Backend

↓

Anthropic API

↓

Structured JSON

↓

Response

↓

Temporary processing data removed

Avoid:

* permanent PDF storage
* unnecessary backups
* unnecessary prompt retention

Status:

**Recommended architecture**

---

# Security Checklist

* HTTPS
* API keys only on backend
* MIME validation
* upload limits
* authentication where appropriate
* dependency updates
* safe production logging
* no stack traces returned to users

Status:

**Industry best practice supporting Article 32**

---

# User Transparency

The Privacy Policy should clearly explain:

* documents are analysed using Anthropic
* uploaded documents may contain personal data
* documents are processed only to deliver the requested analysis
* whether documents are permanently stored
* whether third parties receive data
* user rights under GDPR

Status:

**Legal requirement**

---

# Data Minimisation

Where technically practical, consider removing information unnecessary for property analysis before sending documents to the AI provider.

Possible examples:

* phone numbers
* email addresses
* signatures

Only do this if it does not reduce analysis quality.

Status:

**Recommended implementation of the Article 5 minimisation principle**

---

# Claims the application should NOT make

Do not state:

"We are GDPR compliant."

Instead, describe the concrete measures implemented.

Do not state:

"We never retain data."

unless this is demonstrably true across:

* your infrastructure
* your hosting platform
* your AI provider

Do not state:

"Data never leaves Europe."

unless verified.

---

# Practical Goal

The application should be designed so that:

* personal data is processed only to deliver the requested analysis
* unnecessary personal data is not processed
* uploaded documents are not permanently stored by the application unless there is a documented business need
* users understand exactly how their documents are handled
* security is built into the system from the beginning
* AI providers can be replaced without changing the legal architecture

---

# This document is a technical GDPR implementation guide.

It is **not legal advice**.

Before commercial launch, have a qualified lawyer or privacy professional review the Privacy Policy, Terms of Service, and the overall data-processing model.
