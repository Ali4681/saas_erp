SaaS ERP Database Architecture and API Capability Specification 

# **SaaS ERP** 

## **Database Architecture and API Capability Specification** 

##### Multi-tenant ERP for Delivery, Installment and E-commerce Platform Management 

|**Document version**|1.0|
|---|---|
|**Research date**|21 July 2026|
|**Recommended database**|PostgreSQL 16+|
|**Architecture**|Shared-schema multi-tenant SaaS with strict tenant scoping|
|**Prepared for**|Business Flow / Project Stakeholders|



###### **Scope basis** 

The database reflects the uploaded SaaS ERP contract, the user-confirmed simplified accounting model, and the real API capability of each named external platform. API availability is treated as evidence-based and capability-gated, not assumed. 

Confidential | Prepared for Business Flow | Page 1 

SaaS ERP Database Architecture and API Capability Specification 

### **Document Control and Terminology** 

|**Term**|**Meaning in this specification**|
|---|---|
|Company / Tenant|A subscribed business whose data is isolated from all other subscribed companies.|
|Connectedproject|One connected externalplatform account. It belongs to exactlyone categoryand oneprovider, for example: Delivery> Ninja > “Riyadh Account”.|
|Provider|An external service such as HungerStation, Tabby, Zid, WooCommerce or Shopify.|
|Project location|An outlet, store or branch returned bytheprovider API. It is not automaticallythe same as an ERP companybranch.|
|Company branch|An internal organizational branch required by the contract scope and plan limits. It is optional for day-to-day use and can be mapped to a provider location.|
|External entity|A synchronized record owned byaprovider, such as aproduct, order, driver, settlement or installment transaction.|
|Capability|A specific API action such as ORDER_READ, PRODUCT_UPDATE or DRIVER_CREATE.|



#### **Requested Deliverables Included** 

- Database architecture and design decisions. 

- Complete table catalog and module documentation. 

- Fields, PostgreSQL data types, primary keys and foreign keys. 

- Constraints and recommended indexes. 

- Status and enumeration documentation. 

- Official API availability and capability assessment for the requested providers. 

#### **Contents** 

- 1. Executive Architecture Decisions 

- 2. Branches: Contract Scope and Recommended Use 

- 3. External Platform API Assessment 

- 4. Capability-driven Integration Architecture 

- 5. Database Standards and Tenant Isolation 

- 6. Complete Table Catalog 

- 7. Enumerations and Status Values 

- 8. Cross-cutting Constraints and Index Strategy 

- 9. Deliberate Simplifications and Exclusions 

- 10. Official Sources 

Confidential | Prepared for Business Flow | Page 2 

SaaS ERP Database Architecture and API Capability Specification 

### **1. Executive Architecture Decisions** 

|**Decision**|**Approved design**|
|---|---|
|Project model|Each connected project represents one external platform account and belongs to exactly one category and one provider. Multiple projects may use the same provider.|
|Categories|DELIVERY, INSTALLMENT and ECOMMERCE are seeded categories. Aprovider belongs to one categoryin the first version.|
|API action visibility|The UI must show an action only when provider_capabilities marks it as VERIFIED or contractually enabled for the connected account. Example: “Add driver” is hidden for Ninja until DRIVER_CREATE is confirmed<br>by Ninja documentation or credentials.|
|Product ownership|Products are synchronizedprovider-owned records. There is no central cross-platformproduct master and noproduct mappingbetweenproviders.|
|Accounting|Use simplified operational finance: sales, provider fees, refunds, settlements, expenses and net revenue. Do not implement chart of accounts, journals, trial balance or full general ledger in V1.|
|Plans|Plan features use a simple feature-codeplus enabled flagand optional numeric limit. No complex entitlementgraph.|
|Roles|Use fixed seeded roles: Platform Super Admin, Company Owner, Company Admin, Accountant, Operations Manager, Employee/Viewer. Permission mapping remains data-driven.|
|Storeplatforms|Include Zid, Salla, WooCommerce on WordPress, and Shopifyas the recommended additional matureplatform.|
|Database|PostgreSQL is recommended for UUID support, JSONB integration payloads, partial indexes and row-level security options.|
|Providerpayloads|Normalize fields used bybusiness workflows, while retainingraw_payload JSONB onlyat integration boundaries for traceabilityandprovider-specific extensions.|



#### **1.1 High-level Relationship Map** 

###### **Conceptual model** 

Platform Owner -> Plans -> Company Subscriptions -> Companies -> Users / Branches / Departments Company -> Connected Projects -> Provider + Category + Credentials + Capabilities 

Connected Project -> Provider Locations -> Synchronized Products / Orders / Customers / Drivers / Settlements Connected Project (Installment) -> Installment Transactions -> Events / Refunds / Disputes Company -> CRM / Sales / Purchasing / Internal Inventory / Simplified Finance / HR / Work Projects All write operations -> Provider Operation Requests -> Integration Jobs -> Errors / Webhook Events / Audit Logs 

#### **1.2 Why the Capability Matrix Is Essential** 

- Providers expose different APIs and different scopes, even inside the same category. 

- A public merchant portal does not prove that a public API exists. 

- Access may depend on commercial approval, NDA, account type, country and granted OAuth scopes. 

- The same database can support new providers without adding provider-specific columns to core tables. 

- Unsupported actions remain hidden instead of failing after the user attempts them. 

Confidential | Prepared for Business Flow | Page 3 

SaaS ERP Database Architecture and API Capability Specification 

### **2. Branches: Contract Scope and Recommended Use** 

###### **Direct answer** 

Yes. Branches are explicitly contained in the uploaded contract: the Super Admin manages branch limits per company, and the Company Admin manages branches and departments. A minimal branches model is therefore necessary for contractual scope, subscriptions and reporting. It should remain optional in operational workflows. 

#### **2.1 Keep Two Different Concepts** 

|**Concept**|**Stored in**|**Purpose**|**Mandatory?**|
|---|---|---|---|
|ERP company branch|company_branches|Internal organization, plan limits, employees, warehouses, invoice settings and reporting.|Table required; individual branch records<br>optional.|
|Provider outlet/store|project_locations|External location synchronized from HungerStation, Keeta, Salla, Zid, Shopify, WooCommerce or another<br>provider.|Created only when returned or required<br>bytheprovider.|
|Optional mapping|project_locations.company_branch_id|Links an external outlet/store to the corresponding internal branch without forcing both concepts to be identical.|Optional.|



#### **2.2 Minimal Branch Fields** 

- code, name, status, phone, city and address_line are enough for V1. 

- Do not create a complex geographic hierarchy unless a real module later requires it. 

- The subscription feature BRANCH_LIMIT counts active company_branches, not provider outlets. 

- External location data stays provider-scoped to prevent ID collisions and accidental cross-platform updates. 

Confidential | Prepared for Business Flow | Page 4 

SaaS ERP Database Architecture and API Capability Specification 

### **3. External Platform API Assessment** 

###### **Evidence rule** 

“No public documentation found” is not treated as proof that a provider has no private API. Such providers are marked UNVERIFIED_PUBLICLY or PARTNER_PORTAL and their connector remains disabled until official documentation, credentials and scopes are supplied. No provider is marked NOT_SUPPORTED solely because its API is private. 

|**Provider**|**Category**|**Evidence status**|**Verified manageable areas**|**Limitation / not yet verified**|**ERP connector decision**|
|---|---|---|---|---|---|
|HungerStation|Delivery|PUBLIC_DOCUMENTED|OAuth2; catalog/products/categories; order<br>notifications/details/history/updates; promotions; outlet status/management;<br>webhooks.|Driver creation or driver administration is not listed in the public Partner<br>API.|Enable verified capabilities. [S1]|
|The Chefz|Delivery|UNVERIFIED_PUBLICLY|Official restaurant onboarding and branch registration are public.|No public developer API documentation was verified.|Keep connector disabled until official API package is<br>received. [S2]|
|ToYou|Delivery|UNVERIFIED_PUBLICLY|Official merchant partnership is public.|No public developer API documentation was verified.|Onboarding placeholder only; no management actions. [S3]|
|Mrsool|Delivery|PRIVATE_CONFIRMED|Official site confirms direct integration and provision of products/menu data<br>and photos.|Exact order, outlet, settlement and driver endpoints are not public.|Enable only capabilities contained in the partner contract/docs.<br>[S4]|
|Ninja|Delivery|PARTNER_PORTAL|Official restaurant portal exists.|No public API reference was verified; DRIVER_CREATE is not<br>evidenced.|Hide driver CRUD until Ninja grants and documents it. [S5]|
|Jahez|Delivery|PARTNER_PORTAL|Official Integration Portal exists.|Endpoint list and scopes are account-gated.|Use dynamic capabilityactivation after Jahez onboarding. [S6]|
|Keeta|Delivery|PUBLIC_DOCUMENTED|OAuth2 and webhooks; Basic, Order, Store and Menu APIs; order<br>lifecycle/cancellation, location/hours/availability, menu synchronization.|Developer signup, NDA, SIT and UAT approval are required.|Enable verified scopes after approval. [S7]|
|Shgardi|Delivery|UNVERIFIED_PUBLICLY|Official partner app supports requesting and tracking couriers, communication<br>and work-hour/budget management.|A public server-to-server API reference was not verified.|Treat partner-app features as UI evidence only, not API<br>evidence. [S8]|
|Tabby|Installment|PUBLIC_DOCUMENTED|Checkout sessions; retrieve/update/list payments; capture, refund and close;<br>webhooks; disputes and evidence.|Consumer repayment schedules are not required in the ERP.|Enable transaction, payment, refund, webhook and dispute<br>capabilities. [S9]|
|Tamara|Installment|PUBLIC_DOCUMENTED|Online/in-store checkout; authorize, cancel and capture orders; order details;<br>refunds; webhooks; dispute APIs.|Settlement visibility is documented mainly in the merchant portal; API<br>scope must be confirmed before automated settlement sync.|Enable public API operations; capability-gate settlement<br>import. [S10]|
|Madfu|Installment|UNVERIFIED_PUBLICLY|Official merchant/service site exists.|No public developer API reference was verified.|Connector disabled pending official integration package. [S11]|
|MIS Pay|Installment|PUBLIC_DOCUMENTED|REST integration for token generation, checkout start, callback, checkout<br>detail, tracking and checkout completion.|Public guide does not establish refund, dispute or settlement APIs.|Enable checkout/tracking only unless more scopes are<br>supplied. [S12]|
|Emkan|Installment|PARTNER_PORTAL|Official merchant portal exposes Developer Tools and Pay Later programs.|The exact public endpoint catalog was not accessible without onboarding.|Capability activation follows account-gated documentation.<br>[S13]|
|Zid|E-commerce|PUBLIC_DOCUMENTED|Orders, reversed orders and abandoned carts; products/variants;<br>inventory/locations; shipping; promotions/discounts; customers; settings;<br>webhooks.|Use only scopes approved for the installed partner app.|Enable broad e-commerce synchronization and supported<br>writes. [S14]|
|Salla|E-commerce|PUBLIC_DOCUMENTED|Merchant REST API and OAuth2; shipping/fulfillment; events; checkout<br>carts/products/discounts; app and recurring payment APIs.|Exact fields and mutations depend on app scopes and API version.|Enable broad connector with scope discovery. [S15]|
|WooCommerce / WordPress|E-commerce|PUBLIC_DOCUMENTED|Current REST v3: orders, refunds, products/variations/categories, customers,<br>coupons, reports, taxes, webhooks, settings,payment and shippingresources.|Store owner must create and securely grant API credentials.|Recommended for custom WordPress stores. [S16]|
|Shopify|E-commerce|PUBLIC_DOCUMENTED|Versioned GraphQL Admin API for customers, discounts, inventory, orders,<br>rodcts shiin/flfillment aments store roerties and ebhooks|Access is controlled by app scopes and version lifecycle.|Recommended additional platform because of its mature,<br>broad ersioned API [S17]|
|**3.1 Impor**<br>**Ninja exampl**<br>The requested|**tant Drive**<br>**e**<br>navigation “Del|**r-management F**<br>ivery Projects -> Ninja ->|pu, ppgu, py,  pp  w.<br>**inding**<br>Add New Driver” is valid only as a potential workflow. Th|e database supports driver records and DRIVER_CREA|v .<br>TE requests, but the button must|



Confidential | Prepared for Business Flow | Page 5 

SaaS ERP Database Architecture and API Capability Specification 

remain hidden until Ninja provides an official API and grants that capability. HungerStation’s public API and Keeta’s public scope do not document merchant-side driver creation. 

#### **3.2 Initial Capability Groups** 

|**Group**|**Capability codes**|
|---|---|
|Account|ACCOUNT_READ, ACCOUNT_UPDATE|
|Locations|LOCATION_READ, LOCATION_UPDATE, LOCATION_STATUS_UPDATE|
|Catalog|CATEGORY_READ/WRITE, PRODUCT_READ/CREATE/UPDATE, INVENTORY_READ/UPDATE|
|Orders|ORDER_READ, ORDER_ACCEPT, ORDER_UPDATE, ORDER_CANCEL, ORDER_STATUS_UPDATE|
|Delivery|FULFILLMENT_READ/UPDATE, DRIVER_READ/CREATE/UPDATE, TRACKING_READ|
|Commercial|PROMOTION_READ/WRITE, REPORT_READ, SETTLEMENT_READ|
|Installments|CHECKOUT_CREATE, PAYMENT_READ/AUTHORIZE/CAPTURE/CANCEL/CLOSE/REFUND, DISPUTE_READ/RESPOND|
|Integration|WEBHOOK_REGISTER, WEBHOOK_RECEIVE, BULK_SYNC|



Confidential | Prepared for Business Flow | Page 6 

SaaS ERP Database Architecture and API Capability Specification 

### **4. Capability-driven Integration Architecture** 

#### **4.1 Provider Adapter Contract** 

- Each provider adapter implements only the capability codes verified for that provider and connected account. 

- Provider-specific authentication is stored as encrypted ciphertext, never as visible columns or log data. 

- Inbound webhooks are persisted before processing and handled idempotently. 

- Outbound write actions are first recorded in provider_operation_requests, then executed asynchronously. 

- Every synchronized entity uses the pair (connected_project_id, external_id) as its natural provider boundary. 

- API-specific fields not required by ERP workflows remain in raw_payload JSONB rather than expanding the normalized schema. 

#### **4.2 Read and Write Flow** 

|**Flow**|**Required behavior**|
|---|---|
|Initial connection|Create connected_projects -> encrypt credentials -> test authentication -> import account/locations -> resolve effective capabilities.|
|Scheduled sync|Create integration_job -> callprovider -> upsert normalized rows by project + external_id -> updateproject_sync_states.|
|Webhook|Insert webhook_event -> validate signature -> de-duplicate -> process -> upsert entity -> mark processed or failed.|
|ERP write action|Validateprovider capability-> createprovider_operation_request with idempotencykey-> execute -> store response/external reference -> re-sync entity.|
|Failure|Record integration_error -> increment attempts -> retry only when retryable -> notify operations after threshold.|



#### **4.3 Effective Capability Rule** 

###### **Evaluation formula** 

effective_capability = provider_capability is VERIFIED/PARTNER_ENABLED AND connected project credentials contain the required granted scope AND project status is ACTIVE. The frontend and backend must use the same evaluation service. 

Confidential | Prepared for Business Flow | Page 7 

SaaS ERP Database Architecture and API Capability Specification 

### **5. Database Standards and Tenant Isolation** 

|**Standard**|**Rule**|
|---|---|
|Primary keys|uuid with gen_random_uuid().|
|Tenant key|company_id uuid NOT NULL on everytenant-owned business table. Global catalogtables do not carrycompany_id.|
|Time|timestamptz in UTC; company timezone is used only for presentation and local scheduling.|
|Money|numeric(18,2)plus currencychar(3). Never use floating-point types.|
|External IDs|varchar(191) or text; never assume numeric provider IDs.|
|Status values|PostgreSQL enum or validated varchar. Application code mustpreserve unknownprovider statuses in raw_payload and mapknown values to normalized enums.|
|Secrets|bytea encrypted ciphertext with key version; never return through general serializers.|
|Soft deletion|Use deleted_at onlyfor user-managed master data. Do not soft-delete webhook, audit, settlement or financial history.|
|JSONB|Allowed for provider payloads, configurable conditions/actions and non-core settings. Do not use JSONB as a substitute for relational fields used in filtering/reporting.|
|Tenant isolation|Application-level companyscope on every query; PostgreSQL row-level securityis recommended as defense in depth.|
|PII|Encrypt customer/driver phone and email where retained. Apply provider contract retention rules and avoid importing unnecessary personal data.|
|Auditability|Everyadministrative or write action records actor, entity, action, timestampand relevant metadata.|



#### **5.1 Field Legend Used in the Catalog** 

|**Marker**||**Meaning**|
|---|---|---|
|PK|Primary key||
|FK|Foreign key||
|NN|NOT NULL||
|UQ|Unique constraint||
|D:|Default value||
|ENC|Encrypted at application or database layer||
|JSONB|Provider/configuration extension data||



Confidential | Prepared for Business Flow | Page 8 

SaaS ERP Database Architecture and API Capability Specification 

### **6. Complete Table Catalog** 

###### **Catalog format** 

Every row below specifies the complete V1 field set, main relationships, and essential constraints/indexes. Timestamps are intentionally shown only where they are operationally important; standard created_at and updated_at should be added to mutable master records. 

#### **6.1 SaaS, Tenancy, Users and Subscriptions** 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|companies|Tenant/company master record.|id uuid PK; legal_name varchar(180) NN; display_name varchar(180) NN; slug varchar(80) NN UQ; status<br>company_status NN; default_currency char(3) NN; timezone varchar(64) NN; country_code char(2);<br>created_at timestamptz NN; updated_at timestamptz NN; deleted_at timestamptz.|Parent of all tenant-owned records.|UQ(slug); IDX(status); soft-delete only after subscription<br>closure.|
|company_settings|Minimal company-wide tax, invoice, email<br>and module settings.|company_id uuid PK FK; tax_number varchar(80); invoice_prefix varchar(20) NN; next_invoice_number<br>bigint NN D:1; default_tax_rate numeric(5,2) NN D:0; email_from_name varchar(120); email_from_address<br>varchar(254); settings jsonb NN D:{}; updated_at timestamptz NN.|1:1 companies.|CHECK tax 0..100; next_invoice_number > 0.|
|company_branches|Internal organizational branches required by<br>contract and plan limits.|id uuid PK; company_id uuid FK NN; code varchar(30) NN; name varchar(140) NN; status record_status NN;<br>phone varchar(40); city varchar(100); address_line text; created_at timestamptz NN; updated_at timestamptz<br>NN; deleted_at timestamptz.|Company; departments; employees; warehouses;<br>optional project_locations mapping.|UQ(company_id, code) WHERE deleted_at IS NULL;<br>IDX(company_id,status).|
|company_departments|Simple company department hierarchy.|id uuid PK; company_id uuid FK NN; branch_id uuid FK; parent_department_id uuid FK; code varchar(30);<br>name varchar(140) NN; status record_status NN; created_at timestamptz NN; updated_at timestamptz NN.|Company; optional branch and parent department.|UQ(company_id,code) when code not null; prevent self-<br>parent; IDX(company_id,branch_id).|
|users|Global login identity.|id uuid PK; full_name varchar(160) NN; email varchar(254) UQ; phone varchar(40) UQ; password_hash text<br>NN; locale varchar(10) NN D:en; is_platform_admin boolean NN D:false; status user_status NN;<br>last_login_at timestamptz; created_at timestamptz NN; updated_at timestamptz NN.|Joins companies through company_users.|At least email or phone; case-insensitive unique email<br>recommended.|
|company_users|Membership of a user in a company with one<br>fixed role.|id uuid PK; company_id uuid FK NN; user_id uuid FK NN; role_id uuid FK NN; branch_id uuid FK;<br>department_id uuid FK; status user_status NN; joined_at timestamptz NN.|Company, user, seeded role; optional<br>branch/department.|UQ(company_id,user_id); IDX(company_id,role_id,status).|
|roles|Seeded platform and tenant roles.|id uuid PK; code varchar(50) NN UQ; name varchar(100) NN; scope role_scope NN; is_system boolean NN<br>D:true.|Referenced by company_users and<br>role_permissions.|Seed: PLATFORM_SUPER_ADMIN,<br>COMPANY_OWNER, COMPANY_ADMIN,<br>ACCOUNTANT, OPERATIONS_MANAGER,<br>EMPLOYEE_VIEWER.|
|permissions|Atomic permission catalog.|id uuid PK; code varchar(100) NN UQ; module varchar(60) NN; action varchar(40) NN; description text.|Many-to-many with roles.|UQ(module,action); immutable permission codes after<br>release.|
|role_permissions|Maps seeded roles to permissions.|role_id uuid PK FK; permission_id uuid PK FK.|roles <-> permissions.|Composite PK(role_id,permission_id); index permission_id.|
|plans|Simple SaaS pricing plans.|id uuid PK; code varchar(40) NN UQ; name varchar(120) NN; billing_interval billing_interval NN; price<br>numeric(18,2) NN; currencychar(3) NN; is_active boolean NN D:true; sort_order smallint NN D:0.|Parent of plan_features and subscriptions.|CHECK price >= 0; IDX(is_active,sort_order).|
|plan_features|Feature switches and numeric limits without<br>complex entitlements.|plan_id uuid PK FK; feature_code varchar(60) PK; is_enabled boolean NN D:true; limit_value integer.|Belongs to plan.|Composite PK; CHECK limit_value is null or >=0.<br>Suggested codes: USER_LIMIT, BRANCH_LIMIT,<br>PROJECT_LIMIT, module flags.|
|subscriptions|Company plan lifecycle.|id uuid PK; company_id uuid FK NN; plan_id uuid FK NN; status subscription_status NN; starts_at<br>timestamptz NN; ends_at timestamptz NN; trial_ends_at timestamptz; auto_renew boolean NN D:true;<br>cancelled_at timestamptz.|Company and plan; invoices.|Only one ACTIVE/TRIALING subscription per company<br>via partial UQ; ends_at > starts_at.|
|subscription_invoices|Invoices issued by the SaaS platform to a<br>company.|id uuid PK; subscription_id uuid FK NN; invoice_number varchar(50) NN UQ; issued_at timestamptz NN;<br>due_at timestamptz NN; status invoice_status NN; subtotal numeric(18,2) NN; tax_amount numeric(18,2) NN<br>D:0; total_amount numeric(18,2) NN; currency char(3) NN; paid_at timestamptz.|Subscription; payments.|CHECK amounts >=0; IDX(subscription_id,status,due_at).|
|subscription_payments|Payments against SaaS subscription invoices.|id uuid PK; subscription_invoice_id uuid FK NN; provider varchar(50) NN; external_payment_id<br>varchar(191); amount numeric(18,2) NN; currency char(3) NN; status payment_status NN; paid_at<br>timestamptz; created_at timestamptz NN.|Belongs to subscription invoice.|UQ(provider,external_payment_id) when present; CHECK<br>amount>0; IDX(invoice,status).|
|notifications|In-app notifications for platform or company<br>users.|id uuid PK; company_id uuid FK; user_id uuid FK; type varchar(60) NN; title varchar(180) NN; body text<br>NN; action_url text; read_at timestamptz; created_at timestamptz NN.|Optional company/user for platform-wide<br>announcements.|IDX(user_id,read_at,created_at DESC); delete by retention<br>policy.|



Confidential | Prepared for Business Flow | Page 9 

SaaS ERP Database Architecture and API Capability Specification 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|audit_logs|Immutable security and administrative<br>activity log.|id uuid PK; company_id uuid FK; actor_user_id uuid FK; action varchar(80) NN; entity_type varchar(80) NN;<br>entity_id uuid; ip_address inet; user_agent text; metadata jsonb NN D:{}; created_at timestamptz NN.|Optional tenant and actor.|Append-only; IDX(company_id,created_at DESC);<br>IDX(entity_type,entity_id); monthly partition later if<br>needed.|



Confidential | Prepared for Business Flow | Page 10 

SaaS ERP Database Architecture and API Capability Specification 

#### **6.2 Integration Foundation** 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|platform_categories|Seeded top-level connected-project<br>categories.|id uuid PK; code varchar(30) NN UQ; name varchar(80) NN; is_active boolean NN D:true.|Parent of providers and projects.|Seed DELIVERY, INSTALLMENT, ECOMMERCE.|
|platform_providers|Provider catalog and API evidence status.|id uuid PK; category_id uuid FK NN; code varchar(50) NN UQ; name varchar(120) NN; api_availability<br>api_availability NN; official_docs_url text; requires_approval boolean NN D:false; is_active boolean NN<br>D:true.|Category; projects; provider_capabilities.|UQ(code); IDX(category_id,is_active).|
|capabilities|Global list of possible API actions.|id uuid PK; code varchar(80) NN UQ; name varchar(140) NN; entity_type varchar(60) NN; direction<br>capability_direction NN; description text.|Mapped to providers and operation requests.|Immutable code; IDX(entity_type,direction).|
|provider_capabilities|Evidence-backed capability matrix per<br>provider.|provider_id uuid PK FK; capability_id uuid PK FK; support_status capability_support_status NN;<br>required_scope varchar(160); notes text; source_url text; verified_at date.|Provider <-> capability.|Composite PK; only VERIFIED or PARTNER_ENABLED<br>may be executable.|
|connected_projects|One external provider account managed by<br>one company.|id uuid PK; company_id uuid FK NN; category_id uuid FK NN; provider_id uuid FK NN; name varchar(160)<br>NN; external_account_id varchar(191); environment project_environment NN; status project_status NN;<br>default_currency char(3); last_successful_sync_at timestamptz; created_by uuid FK NN; created_at<br>timestamptz NN; updated_at timestamptz NN.|Company, category, provider, creator; parent of all<br>external data.|Provider.category must equal category_id;<br>UQ(company_id,provider_id,name);<br>IDX(company_id,category_id,status).|
|project_credentials|Encrypted API credentials for a connected<br>project.|id uuid PK; connected_project_id uuid FK NN UQ; auth_type auth_type NN; credentials_ciphertext bytea NN<br>ENC; key_version smallint NN; expires_at timestamptz; status credential_status NN; rotated_at timestamptz;<br>updated_at timestamptz NN.|1:1 connected project.|Never expose in general queries/logs; key_version >0; rotate<br>on compromise.|
|project_locations|External provider outlets/stores/branches.|id uuid PK; connected_project_id uuid FK NN; company_branch_id uuid FK; external_id varchar(191) NN;<br>name varchar(180) NN; code varchar(80); status record_status NN; timezone varchar(64); city varchar(100);<br>address_line text; latitude numeric(9,6); longitude numeric(9,6); raw_payload jsonb NN D:{}; last_synced_at<br>timestamptz.|Project; optional ERP company branch; parent of<br>location-scoped external entities.|UQ(project,external_id); IDX(project,status); coordinate<br>checks.|
|project_sync_states|Incremental synchronization cursor and<br>health per entity.|id uuid PK; connected_project_id uuid FK NN; entity_type varchar(60) NN; direction sync_direction NN;<br>cursor text; last_synced_at timestamptz; last_status sync_status NN; consecutive_failures integer NN D:0;<br>last_error_at timestamptz.|Connected project.|UQ(project,entity_type,direction); CHECK failures>=0.|
|provider_operation_requests|Durable queue of user-requested provider<br>write actions.|id uuid PK; connected_project_id uuid FK NN; capability_id uuid FK NN; requested_by uuid FK NN;<br>operation_type varchar(80) NN; idempotency_key varchar(120) NN; external_target_id varchar(191); payload<br>jsonb NN; status operation_status NN; response_external_id varchar(191); failure_message text; created_at<br>timestamptz NN; processed_at timestamptz.|Project, capability and requesting user.|UQ(project,idempotency_key);<br>IDX(project,status,created_at); reject unsupported capability<br>before insert.|
|integration_jobs|Execution record for imports, exports and<br>reconciliation.|id uuid PK; connected_project_id uuid FK NN; job_type varchar(60) NN; entity_type varchar(60); status<br>job_status NN; attempt_count smallint NN D:0; scheduled_at timestamptz NN; started_at timestamptz;<br>finished_at timestamptz; metrics jsonb NN D:{}.|Connected project; parent of integration_errors.|IDX(status,scheduled_at); CHECK attempt_count>=0; only<br>one active full sync per project/entity via partial UQ.|
|integration_errors|Aggregated retryable/non-retryable<br>integration errors.|id uuid PK; connected_project_id uuid FK NN; integration_job_id uuid FK; operation_request_id uuid FK;<br>error_code varchar(100); message text NN; is_retryable boolean NN D:false; payload_excerpt text;<br>occurrence_count integer NN D:1; first_seen_at timestamptz NN; last_seen_at timestamptz NN.|Project; optional job or operation request.|IDX(project,last_seen_at DESC); CHECK<br>occurrence_count>0.|
|webhook_events|Raw inbound provider events, persisted<br>before processing.|id uuid PK; connected_project_id uuid FK NN; provider_event_id varchar(191); event_type varchar(120) NN;<br>payload jsonb NN; signature_valid boolean; status webhook_status NN; received_at timestamptz NN;<br>processed_at timestamptz; error_message text; payload_hash char(64) NN.|Connected project.|UQ(project,provider_event_id) when present;<br>UQ(project,payload_hash) fallback as appropriate;<br>IDX(status,received_at).|



Confidential | Prepared for Business Flow | Page 11 

SaaS ERP Database Architecture and API Capability Specification 

#### **6.3 Synchronized Provider Data** 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|external_categories|Provider-owned catalog category mirror.|id uuid PK; connected_project_id uuid FK NN; project_location_id uuid FK; external_id varchar(191) NN;<br>parent_external_id varchar(191); name varchar(180) NN; status record_status NN; sort_order integer;<br>raw_payload jsonb NN D:{}; last_synced_at timestamptz NN.|Project; optional location; external products<br>reference normalized category id.|UQ(project,external_id); IDX(project,location,status).|
|external_products|Provider-owned product mirror; no cross-<br>provider master product.|id uuid PK; connected_project_id uuid FK NN; project_location_id uuid FK; external_category_id uuid FK;<br>external_id varchar(191) NN; sku varchar(120); name varchar(220) NN; description text; status record_status<br>NN; price numeric(18,2); currency char(3); tax_rate numeric(5,2); image_url text; raw_payload jsonb NN<br>D:{}; last_synced_at timestamptz NN.|Project/location/category; variants, inventory and<br>order items.|UQ(project,external_id); IDX(project,status);<br>IDX(project,sku) when sku present.|
|external_product_variants|Provider-owned product variations/options.|id uuid PK; external_product_id uuid FK NN; external_id varchar(191) NN; sku varchar(120); name<br>varchar(180) NN; status record_status NN; price numeric(18,2); raw_payload jsonb NN D:{}; last_synced_at<br>timestamptz NN.|Belongs to external_product.|UQ(product,external_id); IDX(product,status).|
|external_inventory_levels|Inventory quantities synchronized per<br>provider location/product/variant.|id uuid PK; connected_project_id uuid FK NN; project_location_id uuid FK NN; external_product_id uuid FK<br>NN; external_product_variant_id uuid FK; external_id varchar(191); quantity_available numeric(18,3);<br>quantity_reserved numeric(18,3); status record_status NN; external_updated_at timestamptz; last_synced_at<br>timestamptz NN.|<br>Project, location, product, optional variant.|UQ(project,location,product,variant); CHECK quantities<br>>=0 when provider semantics allow.|
|external_customers|Minimal provider customer mirror for order<br>and reporting needs.|id uuid PK; connected_project_id uuid FK NN; external_id varchar(191) NN; display_name varchar(180);<br>email_ciphertext bytea ENC; phone_ciphertext bytea ENC; status record_status NN; data_retention_until date;<br>raw_payload jsonb NN D:{}; last_synced_at timestamptz NN.|<br>Project; external orders.|UQ(project,external_id); IDX(project,status);<br>purge/anonymize by retention policy.|
|external_orders|Normalized provider order header across<br>delivery and e-commerce.|id uuid PK; connected_project_id uuid FK NN; project_location_id uuid FK; external_customer_id uuid FK;<br>external_id varchar(191) NN; external_number varchar(120); status normalized_order_status NN;<br>financial_status financial_status; fulfillment_status fulfillment_status; placed_at timestamptz NN; currency<br>char(3) NN; subtotal numeric(18,2) NN D:0; discount_amount numeric(18,2) NN D:0; tax_amount<br>numeric(18,2) NN D:0; delivery_fee numeric(18,2) NN D:0; provider_fee numeric(18,2) NN D:0;<br>total_amount numeric(18,2) NN; net_amount numeric(18,2); payment_method varchar(80); raw_payload<br>jsonb NN D:{}; last_synced_at timestamptz NN.|Project, location, customer; items, statuses,<br>refunds, fulfillment.|UQ(project,external_id); IDX(project,placed_at DESC);<br>IDX(project,status); CHECK monetary values >=0 except<br>net adjustments if provider permits.|
|external_order_items|Provider order line mirror preserving<br>historical names/prices.|id uuid PK; external_order_id uuid FK NN; external_id varchar(191); external_product_id uuid FK;<br>external_product_variant_id uuid FK; name varchar(220) NN; sku varchar(120); quantity numeric(18,3) NN;<br>unit_price numeric(18,2) NN; discount_amount numeric(18,2) NN D:0; tax_amount numeric(18,2) NN D:0;<br>total_amount numeric(18,2) NN; raw_payload jsonb NN D:{}.|Order; optional synchronized product and variant.|UQ(order,external_id) when present; CHECK quantity>0;<br>IDX(order).|
|external_order_status_history|Append-only normalized and raw provider<br>order transitions.|id uuid PK; external_order_id uuid FK NN; external_status varchar(100) NN; normalized_status<br>normalized_order_status NN; source event_source NN; occurred_at timestamptz NN; raw_payload jsonb NN<br>D:{}.|Belongs to external_order.|IDX(order,occurred_at); append-only; de-duplicate by<br>order/status/occurred_at when event ID absent.|
|external_refunds|Refunds for provider orders.|id uuid PK; connected_project_id uuid FK NN; external_order_id uuid FK; external_id varchar(191) NN;<br>status refund_status NN; amount numeric(18,2) NN; currency char(3) NN; reason text; requested_at<br>timestamptz; processed_at timestamptz; raw_payload jsonb NN D:{}.|Project and optional external order.|UQ(project,external_id); CHECK amount>0;<br>IDX(order,status).|
|external_fulfillments|Shipment/delivery state and tracking.|id uuid PK; connected_project_id uuid FK NN; external_order_id uuid FK NN; external_driver_id uuid FK;<br>external_id varchar(191) NN; status fulfillment_status NN; tracking_number varchar(160); tracking_url text;<br>pickup_at timestamptz; delivered_at timestamptz; delivery_fee numeric(18,2); raw_payload jsonb NN D:{}.|Project, order, optional driver.|UQ(project,external_id); IDX(order,status); delivered_at >=<br>pickup_at when both exist.|
|external_promotions|Provider promotion/discount mirror.|id uuid PK; connected_project_id uuid FK NN; project_location_id uuid FK; external_id varchar(191) NN;<br>name varchar(180) NN; promotion_type varchar(60) NN; value numeric(18,2); starts_at timestamptz; ends_at<br>timestamptz; status record_status NN; raw_payload jsonb NN D:{}.|Project and optional location.|UQ(project,external_id); ends_at > starts_at;<br>IDX(project,status).|
|external_drivers|Provider driver/courier mirror, activated only<br>for supported capabilities.|id uuid PK; connected_project_id uuid FK NN; project_location_id uuid FK; external_id varchar(191) NN;<br>name varchar(180); phone_ciphertext bytea ENC; status record_status NN; vehicle_type varchar(80);<br>raw_payloadjsonb NN D:{}; last_synced_at timestamptz NN.|Project/location; fulfillments.|UQ(project,external_id); no create/update unless capability<br>verified; IDX(project,status).|
|external_settlements|Provider settlement/reconciliation records for<br>all categories.|id uuid PK; connected_project_id uuid FK NN; external_id varchar(191) NN; period_start date; period_end<br>date; status settlement_status NN; gross_sales numeric(18,2) NN D:0; provider_fees numeric(18,2) NN D:0;<br>refunds numeric(18,2) NN D:0; adjustments numeric(18,2) NN D:0; net_amount numeric(18,2) NN; currency<br>char(3) NN; expected_at date; paid_at timestamptz; raw_payload jsonb NN D:{}.|Project; simplified finance entries.|UQ(project,external_id); CHECK<br>period_end>=period_start; IDX(project,status,period_end<br>DESC).|
|installment_transactions|Merchant-side BNPL/financing transaction.|id uuid PK; connected_project_id uuid FK NN; external_id varchar(191) NN; merchant_order_reference<br>varchar(191) NN; external_customer_reference varchar(191); status installment_status NN; amount<br>numeric(18,2) NN; currency char(3) NN; provider_fee numeric(18,2); net_amount numeric(18,2);<br>checkout_url text; authorized_at timestamptz; captured_at timestamptz; closed_at timestamptz; raw_payload<br>jsonb NN D:{}; last_synced_at timestamptz NN.|Installment project; events, refunds, disputes.|UQ(project,external_id);<br>IDX(project,merchant_order_reference); CHECK<br>amount>0.|



Confidential | Prepared for Business Flow | Page 12 

SaaS ERP Database Architecture and API Capability Specification 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|installment_events|Append-only installment transaction<br>status/webhook history.|id uuid PK; installment_transaction_id uuid FK NN; external_event_id varchar(191); event_type varchar(100)<br>NN; status installment_status; occurred_at timestamptz NN; raw_payload jsonb NN D:{}.|Belongs to installment transaction.|UQ(transaction,external_event_id) when present;<br>IDX(transaction,occurred_at).|
|installment_refunds|Refunds specifically tied to BNPL<br>transactions.|id uuid PK; installment_transaction_id uuid FK NN; external_id varchar(191) NN; status refund_status NN;<br>amount numeric(18,2) NN; currency char(3) NN; reason text; requested_at timestamptz; processed_at<br>timestamptz; raw_payloadjsonb NN D:{}.|Belongs to installment transaction.|UQ(transaction,external_id); CHECK amount>0;<br>IDX(transaction,status).|
|installment_disputes|Dispute cases exposed by providers such as<br>Tabby/Tamara.|id uuid PK; installment_transaction_id uuid FK NN; external_id varchar(191) NN; status dispute_status NN;<br>reason varchar(180); amount numeric(18,2); due_at timestamptz; resolved_at timestamptz; raw_payload jsonb<br>NN D:{}.|Belongs to installment transaction.|UQ(transaction,external_id); IDX(status,due_at);<br>amount>=0 when present.|



Confidential | Prepared for Business Flow | Page 13 

SaaS ERP Database Architecture and API Capability Specification 

#### **6.4 CRM** 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|crm_contacts|Single lightweight table for leads and<br>customers.|id uuid PK; company_id uuid FK NN; contact_type crm_contact_type NN; name varchar(180) NN;<br>company_name varchar(180); email varchar(254); phone varchar(40); source varchar(80); status record_status<br>NN; owner_user_id uuid FK; notes text; created_at timestamptz NN; updated_at timestamptz NN.|Company; owner; opportunities, activities and<br>contracts.|IDX(company,type,status); IDX(company,owner); optional<br>duplicate detection on normalized email/phone.|
|crm_pipelines|Sales pipeline definitions.|id uuid PK; company_id uuid FK NN; name varchar(120) NN; is_default boolean NN D:false; status<br>record_status NN.|Company; stages and opportunities.|UQ(company,name); one default per company via partial<br>UQ.|
|crm_pipeline_stages|Ordered stages within a pipeline.|id uuid PK; crm_pipeline_id uuid FK NN; name varchar(120) NN; position smallint NN; probability<br>numeric(5,2) NN D:0; is_closed boolean NN D:false.|Pipeline; opportunities.|UQ(pipeline,position); probability 0..100.|
|crm_opportunities|Potential sale tracked through a pipeline.|id uuid PK; company_id uuid FK NN; crm_contact_id uuid FK NN; crm_pipeline_id uuid FK NN;<br>crm_pipeline_stage_id uuid FK NN; owner_user_id uuid FK; title varchar(180) NN; estimated_value<br>numeric(18,2); currency char(3); expected_close_date date; status opportunity_status NN; created_at<br>timestamptz NN; updated_at timestamptz NN.|Company, contact, pipeline/stage and owner.|Stage must belong to selected pipeline;<br>IDX(company,stage,status); estimated_value>=0.|
|crm_activities|Calls, meetings, follow-ups and sales tasks in<br>one table.|id uuid PK; company_id uuid FK NN; crm_contact_id uuid FK; crm_opportunity_id uuid FK; activity_type<br>crm_activity_type NN; subject varchar(180) NN; notes text; scheduled_at timestamptz; occurred_at<br>timestamptz; status activity_status NN; assigned_to uuid FK; created_by uuid FK NN; created_at timestamptz<br>NN.|Company; optional contact/opportunity; users.|At least contact or opportunity;<br>IDX(company,assigned_to,status,scheduled_at).|
|crm_contracts|Simple customer contract register.|id uuid PK; company_id uuid FK NN; crm_contact_id uuid FK NN; crm_opportunity_id uuid FK;<br>contract_number varchar(60) NN; title varchar(180) NN; status contract_status NN; starts_on date; ends_on<br>date; value numeric(18,2); currencychar(3); notes text; created_at timestamptz NN.|Company, contact, optional opportunity;<br>attachments through attachments entity link.|UQ(company,contract_number); ends_on>=starts_on;<br>value>=0.|



Confidential | Prepared for Business Flow | Page 14 

SaaS ERP Database Architecture and API Capability Specification 

#### **6.5 Internal Sales** 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|sales_quotes|Customer quotation header and approval<br>state.|id uuid PK; company_id uuid FK NN; crm_contact_id uuid FK NN; quote_number varchar(60) NN; status<br>sales_document_status NN; issued_on date NN; expires_on date; currency char(3) NN; subtotal numeric(18,2)<br>NN; discount_amount numeric(18,2) NN D:0; tax_amount numeric(18,2) NN D:0; total_amount<br>numeric(18,2) NN; created_by uuid FK NN; approved_by uuid FK; created_at timestamptz NN.|Company, CRM customer, users; items and<br>optional invoice conversion.|UQ(company,quote_number); expires_on>=issued_on;<br>amounts>=0; IDX(company,status,issued_on).|
|sales_quote_items|Quotation lines.|id uuid PK; sales_quote_id uuid FK NN; item_id uuid FK; description varchar(240) NN; quantity<br>numeric(18,3) NN; unit_price numeric(18,2) NN; discount_amount numeric(18,2) NN D:0; tax_amount<br>numeric(18,2) NN D:0; total_amount numeric(18,2) NN;position smallint NN.|Quote; optional internal inventory item.|UQ(quote,position); quantity>0; monetary values>=0.|
|sales_invoices|Internal sales invoice header.|id uuid PK; company_id uuid FK NN; crm_contact_id uuid FK NN; sales_quote_id uuid FK; invoice_number<br>varchar(60) NN; status invoice_status NN; issued_on date NN; due_on date; currency char(3) NN; subtotal<br>numeric(18,2) NN; discount_amount numeric(18,2) NN D:0; tax_amount numeric(18,2) NN D:0;<br>total_amount numeric(18,2) NN; balance_due numeric(18,2) NN; created_at timestamptz NN.|Company, customer, optional quote;<br>items/payments/credit notes.|UQ(company,invoice_number); due_on>=issued_on;<br>balance 0..total; IDX(company,status,due_on).|
|sales_invoice_items|Internal sales invoice lines.|id uuid PK; sales_invoice_id uuid FK NN; item_id uuid FK; description varchar(240) NN; quantity<br>numeric(18,3) NN; unit_price numeric(18,2) NN; discount_amount numeric(18,2) NN D:0; tax_amount<br>numeric(18,2) NN D:0; total_amount numeric(18,2) NN;position smallint NN.|Invoice; optional internal item.|UQ(invoice,position); quantity>0; amounts>=0.|
|sales_payments|Receipts against internal sales invoices.|id uuid PK; company_id uuid FK NN; sales_invoice_id uuid FK NN; bank_account_id uuid FK;<br>receipt_number varchar(60) NN; method payment_method NN; amount numeric(18,2) NN; currency char(3)<br>NN; status payment_status NN; paid_at timestamptz NN; external_reference varchar(191).|Company, invoice, optional bank account.|UQ(company,receipt_number); amount>0;<br>IDX(invoice,status).|
|sales_credit_notes|Internal sales return/credit-note header.|id uuid PK; company_id uuid FK NN; sales_invoice_id uuid FK NN; credit_note_number varchar(60) NN;<br>status sales_document_status NN; issued_on date NN; reason text; total_amount numeric(18,2) NN; currency<br>char(3) NN.|Company, source invoice; credit note items.|UQ(company,credit_note_number); total_amount>0;<br>IDX(invoice,status).|
|sales_credit_note_items|Returned/credited invoice lines.|id uuid PK; sales_credit_note_id uuid FK NN; sales_invoice_item_id uuid FK; description varchar(240) NN;<br>quantity numeric(18,3) NN; amount numeric(18,2) NN.|Credit note; optional original invoice item.|quantity>0; amount>0; IDX(credit_note).|



Confidential | Prepared for Business Flow | Page 15 

SaaS ERP Database Architecture and API Capability Specification 

#### **6.6 Purchasing** 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|suppliers|Supplier master record.|id uuid PK; company_id uuid FK NN; code varchar(40); name varchar(180) NN; tax_number varchar(80);<br>email varchar(254); phone varchar(40); status record_status NN; notes text.|Company; purchase orders, bills and payments.|UQ(company,code) when present;<br>IDX(company,status,name).|
|purchase_orders|Purchase request/order in one simple<br>workflow.|id uuid PK; company_id uuid FK NN; supplier_id uuid FK NN; warehouse_id uuid FK; order_number<br>varchar(60) NN; status purchase_order_status NN; ordered_on date; expected_on date; currency char(3) NN;<br>subtotal numeric(18,2) NN; tax_amount numeric(18,2) NN D:0; total_amount numeric(18,2) NN;<br>requested_byuuid FK NN; approved_byuuid FK.|Company, supplier, optional warehouse, users;<br>items and bills.|UQ(company,order_number); expected_on>=ordered_on;<br>IDX(company,status,ordered_on).|
|purchase_order_items|Purchase order lines.|id uuid PK; purchase_order_id uuid FK NN; item_id uuid FK NN; description varchar(240) NN; quantity<br>numeric(18,3) NN; unit_cost numeric(18,2) NN; tax_amount numeric(18,2) NN D:0; total_amount<br>numeric(18,2) NN; position smallint NN.|Purchase order and internal item.|UQ(order,position); quantity>0; costs>=0.|
|supplier_bills|Supplier invoice/bill header.|id uuid PK; company_id uuid FK NN; supplier_id uuid FK NN; purchase_order_id uuid FK; bill_number<br>varchar(80) NN; status invoice_status NN; issued_on date NN; due_on date; currency char(3) NN; subtotal<br>numeric(18,2) NN; tax_amount numeric(18,2) NN D:0; total_amount numeric(18,2) NN; balance_due<br>numeric(18,2) NN.|Company, supplier, optional PO; bill items and<br>payments.|UQ(company,supplier,bill_number); due_on>=issued_on;<br>IDX(company,status,due_on).|
|supplier_bill_items|Supplier bill lines.|id uuid PK; supplier_bill_id uuid FK NN; item_id uuid FK; description varchar(240) NN; quantity<br>numeric(18,3) NN; unit_cost numeric(18,2) NN; tax_amount numeric(18,2) NN D:0; total_amount<br>numeric(18,2) NN; position smallint NN.|Bill; optional internal item.|UQ(bill,position); quantity>0; amounts>=0.|
|supplier_payments|Payments made against supplier bills.|id uuid PK; company_id uuid FK NN; supplier_bill_id uuid FK NN; bank_account_id uuid FK;<br>payment_number varchar(60) NN; method payment_method NN; amount numeric(18,2) NN; currency char(3)<br>NN; status payment_status NN; paid_at timestamptz NN; external_reference varchar(191).|Company, supplier bill, optional bank account.|UQ(company,payment_number); amount>0;<br>IDX(bill,status).|



Confidential | Prepared for Business Flow | Page 16 

SaaS ERP Database Architecture and API Capability Specification 

#### **6.7 Internal Inventory and Warehouses** 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|item_categories|Internal inventory category tree.|id uuid PK; company_id uuid FK NN; parent_id uuid FK; code varchar(40); name varchar(140) NN; status<br>record_status NN.|Company; parent category; internal items.|UQ(company,code) when present; prevent self-parent;<br>IDX(company,status).|
|units|Measurement units.|id uuid PK; company_id uuid FK NN; code varchar(20) NN; name varchar(80) NN; decimal_places smallint<br>NN D:0.|Company; items.|UQ(company,code); decimal_places 0..6.|
|items|Internal ERP item/product master, separate<br>from provider-owned products.|id uuid PK; company_id uuid FK NN; item_category_id uuid FK; unit_id uuid FK NN; sku varchar(120);<br>barcode varchar(120); name varchar(220) NN; status record_status NN; cost numeric(18,2); sale_price<br>numeric(18,2); min_stock numeric(18,3) NN D:0; tax_rate numeric(5,2) NN D:0; created_at timestamptz NN;<br>updated_at timestamptz NN.|Company, category, unit; stock, sales and<br>purchasing lines.|UQ(company,sku) when present; UQ(company,barcode)<br>when present; prices>=0; tax 0..100.|
|warehouses|Simple internal warehouse register.|id uuid PK; company_id uuid FK NN; company_branch_id uuid FK; code varchar(40) NN; name<br>varchar(140) NN; status record_status NN; address_line text.|Company; optional branch; balances, movements<br>and counts.|UQ(company,code); IDX(company,status).|
|stock_balances|Current quantity per item and warehouse.|warehouse_id uuid PK FK; item_id uuid PK FK; quantity_on_hand numeric(18,3) NN D:0; quantity_reserved<br>numeric(18,3) NN D:0; updated_at timestamptz NN.|Warehouse and item.|Composite PK; CHECK reserved>=0; on_hand may be<br>negative only if company setting allows.|
|stock_movements|Append-only inventory ledger.|id uuid PK; company_id uuid FK NN; warehouse_id uuid FK NN; item_id uuid FK NN; movement_type<br>stock_movement_type NN; quantity numeric(18,3) NN; unit_cost numeric(18,2); reference_type varchar(60);<br>reference_id uuid; occurred_at timestamptz NN; created_byuuid FK NN; notes text.|Company, warehouse, item, actor; optional<br>business reference.|quantity<>0; IDX(company,warehouse,item,occurred_at);<br>append-only except reversal entries.|
|stock_counts|Periodic inventory count header.|id uuid PK; company_id uuid FK NN; warehouse_id uuid FK NN; count_number varchar(60) NN; status<br>stock_count_status NN; started_at timestamptz NN; completed_at timestamptz; created_by uuid FK NN;<br>approved_by uuid FK.|Company, warehouse, users; count items.|UQ(company,count_number); completed>=started; only one<br>OPEN count per warehouse via partial UQ.|
|stock_count_items|Counted quantity and variance per item.|id uuid PK; stock_count_id uuid FK NN; item_id uuid FK NN; system_quantity numeric(18,3) NN;<br>counted_quantitynumeric(18,3); variance_quantitynumeric(18,3); notes text.|Stock count and item.|UQ(count,item); variance = counted-system when<br>completed.|



Confidential | Prepared for Business Flow | Page 17 

SaaS ERP Database Architecture and API Capability Specification 

#### **6.8 Simplified Finance** 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|bank_accounts|Minimal cash/bank account register for<br>internal receipts/payments.|id uuid PK; company_id uuid FK NN; name varchar(140) NN; account_type bank_account_type NN;<br>bank_name varchar(140); iban_ciphertext bytea ENC; currency char(3) NN; status record_status NN.|Company; sales/supplier payments and expenses.|IDX(company,status); optional unique encrypted-token/hash<br>for IBAN duplicate detection.|
|expense_categories|Simple expense classification.|id uuid PK; company_id uuid FK NN; code varchar(40); name varchar(120) NN; status record_status NN.|Company; expenses.|UQ(company,code) whenpresent; IDX(company,status).|
|expenses|Company expense records.|id uuid PK; company_id uuid FK NN; expense_category_id uuid FK NN; bank_account_id uuid FK;<br>connected_project_id uuid FK; description varchar(240) NN; amount numeric(18,2) NN; currency char(3)<br>NN; expense_date date NN; status expense_status NN; reference_number varchar(100); created_by uuid FK<br>NN.|Company, category, optional bank/project, creator;<br>finance transactions.|<br>amount>0; IDX(company,expense_date DESC,status);<br>project must belong to company.|
|financial_transactions<br>**Not full acco**|Unified simplified finance ledger for<br>operational reporting, not double-entry<br>accounting.<br>**unting**|id uuid PK; company_id uuid FK NN; connected_project_id uuid FK; transaction_type<br>financial_transaction_type NN; direction financial_direction NN; amount numeric(18,2) NN; currency char(3)<br>NN; occurred_at timestamptz NN; external_order_id uuid FK; installment_transaction_id uuid FK;<br>external_settlement_id uuid FK; expense_id uuid FK; sales_invoice_id uuid FK; supplier_bill_id uuid FK;<br>description text; created_at timestamptz NN.|Company; optional project and one business<br>source.|amount>0; CHECK no more than one source FK;<br>IDX(company,occurred_at DESC,type);<br>IDX(project,occurred_at DESC).|



financial_transactions supports revenue, fees, refunds, settlements, expenses and net-revenue reporting. It intentionally does not implement debit/credit journal lines, chart of accounts, trial balance, balance sheet or general ledger. 

Confidential | Prepared for Business Flow | Page 18 

SaaS ERP Database Architecture and API Capability Specification 

#### **6.9 Human Resources** 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|employees|Minimal employee master.|id uuid PK; company_id uuid FK NN; user_id uuid FK; company_branch_id uuid FK;<br>company_department_id uuid FK; employee_number varchar(40) NN; full_name varchar(180) NN; email<br>varchar(254); phone varchar(40); job_title varchar(120); hire_date date; employment_status<br>employment_status NN; basic_salary numeric(18,2); currency char(3).|Company; optional login user, branch and<br>department; attendance/leave/payroll.|UQ(company,employee_number); UQ(company,user_id)<br>when present; salary>=0.|
|attendance_records|Daily attendance record.|id uuid PK; company_id uuid FK NN; employee_id uuid FK NN; attendance_date date NN; check_in_at<br>timestamptz; check_out_at timestamptz; status attendance_status NN; worked_minutes integer; source<br>varchar(40); notes text.|Company and employee.|UQ(employee,date); check_out>=check_in;<br>worked_minutes>=0; IDX(company,date).|
|leave_requests|Employee leave requests and approval.|id uuid PK; company_id uuid FK NN; employee_id uuid FK NN; leave_type varchar(60) NN; starts_on date<br>NN; ends_on date NN; requested_days numeric(6,2) NN; status leave_status NN; reason text; approved_by<br>uuid FK; decided_at timestamptz.|Company, employee, approving user.|ends>=starts; days>0; IDX(company,status,starts_on).|
|payroll_runs|Payroll period header.|id uuid PK; company_id uuid FK NN; period_start date NN; period_end date NN; status payroll_status NN;<br>total_gross numeric(18,2) NN D:0; total_deductions numeric(18,2) NN D:0; total_net numeric(18,2) NN D:0;<br>processed_at timestamptz; created_byuuid FK NN.|Company; payroll items.|UQ(company,period_start,period_end); period_end>=start;<br>totals>=0.|
|payroll_items|Employee payroll result including<br>allowances, bonuses, advances and<br>deductions.|id uuid PK; payroll_run_id uuid FK NN; employee_id uuid FK NN; basic_salary numeric(18,2) NN;<br>allowances numeric(18,2) NN D:0; bonuses numeric(18,2) NN D:0; deductions numeric(18,2) NN D:0;<br>advances numeric(18,2) NN D:0; net_amount numeric(18,2) NN; status payroll_item_status NN.|Payroll run and employee.|UQ(run,employee); monetary components>=0; net formula<br>validated by service.|



Confidential | Prepared for Business Flow | Page 19 

SaaS ERP Database Architecture and API Capability Specification 

#### **6.10 Internal Work Project Management** 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|work_projects|Internal work/project-management project,<br>deliberately separate from<br>connected_projects.|id uuid PK; company_id uuid FK NN; code varchar(40) NN; name varchar(180) NN; crm_contact_id uuid<br>FK; status work_project_status NN; starts_on date; ends_on date; budget numeric(18,2); currency char(3);<br>owner_user_id uuid FK; progress_percent numeric(5,2) NN D:0; created_at timestamptz NN.|Company, optional CRM customer, owner;<br>phases, members, tasks.|UQ(company,code); progress 0..100; ends>=starts;<br>budget>=0.|
|work_project_members|Project team membership.|work_project_id uuid PK FK; company_user_id uuid PK FK; project_role varchar(80); joined_at date NN.|Work project and company user.|Composite PK; company user must belong to project<br>company.|
|work_project_phases|Ordered project phases/milestones.|id uuid PK; work_project_id uuid FK NN; name varchar(140) NN; position smallint NN; status<br>work_phase_status NN; starts_on date; ends_on date; progress_percent numeric(5,2) NN D:0.|Work project; tasks.|UQ(project,position); progress 0..100; ends>=starts.|
|work_tasks|Internal project tasks and progress.|id uuid PK; work_project_id uuid FK NN; work_project_phase_id uuid FK; assignee_company_user_id uuid<br>FK; parent_task_id uuid FK; title varchar(220) NN; description text; priority task_priority NN; status<br>task_status NN; due_at timestamptz; estimated_hours numeric(8,2); actual_hours numeric(8,2);<br>progress_percent numeric(5,2) NN D:0; created_at timestamptz NN.|Project, optional phase/assignee/parent; comments<br>and attachments.|Phase and assignee must belong to project company; prevent<br>self-parent; IDX(project,status,due_at); progress 0..100.|
|work_task_comments|Task discussion.|id uuid PK; work_task_id uuid FK NN; author_user_id uuid FK NN; body text NN; created_at timestamptz<br>NN; edited_at timestamptz.|Task and author.|IDX(task,created_at); no hard delete after audit-sensitive<br>actions.|



Confidential | Prepared for Business Flow | Page 20 

SaaS ERP Database Architecture and API Capability Specification 

#### **6.11 Automation, Marketing, Files and AI Usage** 

|**Table**|**Purpose**|**Fields (PostgreSQL)**|**Relationships**|**Constraints and indexes**|
|---|---|---|---|---|
|automation_rules|Simple event or schedule-based automation<br>definition.|id uuid PK; company_id uuid FK NN; name varchar(160) NN; module varchar(60) NN; trigger_event<br>varchar(100) NN; conditions jsonb NN D:[]; actions jsonb NN; schedule_cron varchar(120); status<br>automation_status NN; created_by uuid FK NN; created_at timestamptz NN; updated_at timestamptz NN.|Company and creator; automation runs.|Actions non-empty; schedule required only for scheduled<br>trigger; IDX(company,status,module).|
|automation_runs|Automation execution history.|id uuid PK; automation_rule_id uuid FK NN; status automation_run_status NN; trigger_entity_type<br>varchar(80); trigger_entity_id uuid; started_at timestamptz NN; finished_at timestamptz; result jsonb NN<br>D:{}; error_message text.|Automation rule.|IDX(rule,started_at DESC); finished>=started; append-only.|
|marketing_posts|Draft, scheduled and published marketing<br>content.|id uuid PK; company_id uuid FK NN; title varchar(180); content text NN; channel marketing_channel NN;<br>status marketing_post_status NN; scheduled_at timestamptz; published_at timestamptz; external_post_id<br>varchar(191); created_by uuid FK NN; created_at timestamptz NN; updated_at timestamptz NN.|Company and creator; attachments for media.|scheduled_at required for SCHEDULED;<br>IDX(company,status,scheduled_at).|
|attachments|Generic file metadata for contracts, tasks,<br>invoices and other supported entities.|id uuid PK; company_id uuid FK NN; uploaded_by uuid FK NN; entity_type varchar(80) NN; entity_id uuid<br>NN; file_name varchar(255) NN; mime_type varchar(120) NN; size_bytes bigint NN; storage_key text NN<br>UQ; checksum_sha256 char(64) NN; created_at timestamptz NN.|Company and uploader; logical entity link<br>validated by service.|size_bytes>0; IDX(company,entity_type,entity_id); private<br>storage; signed URLs only.|
|ai_usage_logs|Minimal AI usage, cost and audit tracking;<br>no storage of unnecessary prompts.|id uuid PK; company_id uuid FK NN; user_id uuid FK; module varchar(60) NN; provider varchar(60) NN;<br>model varchar(100) NN; input_tokens integer NN D:0; output_tokens integer NN D:0; estimated_cost<br>numeric(18,6) NN D:0; request_reference varchar(120); created_at timestamptz NN.|Company and optional user.|Token/cost values>=0; IDX(company,created_at<br>DESC,module); sensitive prompt content excluded by<br>default.|



Confidential | Prepared for Business Flow | Page 21 

SaaS ERP Database Architecture and API Capability Specification 

### **7. Enumerations and Status Values** 

|**Enum / validated code set**|**Allowed values**|
|---|---|
|company_status|ACTIVE, SUSPENDED, CLOSED|
|record_status|ACTIVE, INACTIVE, ARCHIVED|
|user_status|INVITED, ACTIVE, SUSPENDED, DISABLED|
|role_scope|PLATFORM, TENANT|
|billing_interval|MONTHLY, QUARTERLY, YEARLY|
|subscription_status|TRIALING, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED, EXPIRED|
|invoice_status|DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED|
|payment_status|PENDING, PROCESSING, SUCCEEDED, FAILED, REFUNDED, CANCELLED|
|api_availability|PUBLIC_DOCUMENTED, PARTNER_PORTAL, PRIVATE_CONFIRMED, UNVERIFIED_PUBLICLY, NOT_SUPPORTED|
|capability_direction|READ, WRITE, BOTH, EVENT|
|capability_support_status|VERIFIED, PARTNER_ENABLED, UNVERIFIED, NOT_SUPPORTED|
|project_environment|SANDBOX, PRODUCTION|
|project_status|DRAFT, CONNECTING, ACTIVE, ERROR, DISABLED, REVOKED|
|auth_type|OAUTH2, API_KEY, BASIC, HMAC, CUSTOM|
|credential_status|ACTIVE, EXPIRING, EXPIRED, REVOKED, INVALID|
|sync_direction|IMPORT, EXPORT, BIDIRECTIONAL|
|sync_status|NEVER_RUN, RUNNING, SUCCESS, PARTIAL, FAILED|
|operation_status|PENDING, VALIDATING, PROCESSING, SUCCEEDED, FAILED, CANCELLED|
|job_status|QUEUED, RUNNING, SUCCEEDED, PARTIAL, FAILED, CANCELLED|
|webhook_status|RECEIVED, PROCESSING, PROCESSED, IGNORED, FAILED|
|normalized_order_status|PENDING, CONFIRMED, PREPARING, READY, IN_DELIVERY, DELIVERED, COMPLETED, CANCELLED, REJECTED, FAILED, UNKNOWN|
|financial_status|PENDING, AUTHORIZED, PAID, PARTIALLY_REFUNDED, REFUNDED, FAILED, VOIDED, UNKNOWN|
|fulfillment_status|UNFULFILLED, PROCESSING, READY, PICKED_UP, IN_TRANSIT, DELIVERED, RETURNED, CANCELLED, FAILED, UNKNOWN|
|refund_status|REQUESTED, PENDING, SUCCEEDED, FAILED, CANCELLED|
|settlement_status|PENDING, EXPECTED, PROCESSING, PAID, PARTIALLY_PAID, DISPUTED, FAILED|
|installment_status|CREATED, PENDING, AUTHORIZED, CAPTURED, PARTIALLY_CAPTURED, CLOSED, CANCELLED, EXPIRED, REFUNDED, PARTIALLY_REFUNDED, FAILED, UNKNOWN|
|dispute_status|OPEN, EVIDENCE_REQUIRED, CHALLENGED, ACCEPTED, WON, LOST, CLOSED|
|event_source|POLL, WEBHOOK, USER_ACTION, RECONCILIATION|
|crm_contact_type|LEAD, CUSTOMER|
|opportunity_status|OPEN, WON, LOST, CANCELLED|
|crm_activity_type|CALL, MEETING, FOLLOW_UP, TASK, EMAIL, NOTE|
|activity_status|PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, MISSED|
|contract_status|DRAFT, ACTIVE, EXPIRED, TERMINATED, ARCHIVED|



Confidential | Prepared for Business Flow | Page 22 

SaaS ERP Database Architecture and API Capability Specification 

|**Enum / validated code set**|**Allowed values**|
|---|---|
|sales_document_status|DRAFT, PENDING_APPROVAL, APPROVED, SENT, ACCEPTED, REJECTED, CANCELLED, CLOSED|
|payment_method|CASH, BANK_TRANSFER, CARD, PAYMENT_GATEWAY, OTHER|
|purchase_order_status|DRAFT, REQUESTED, APPROVED, ORDERED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED|
|stock_movement_type|OPENING, PURCHASE_RECEIPT, SALE_ISSUE, RETURN_IN, RETURN_OUT, TRANSFER_IN, TRANSFER_OUT, COUNT_ADJUSTMENT, MANUAL_ADJUSTMENT|
|stock_count_status|DRAFT, IN_PROGRESS, SUBMITTED, APPROVED, CANCELLED|
|bank_account_type|CASH, BANK, PAYMENT_GATEWAY|
|expense_status|DRAFT, APPROVED, PAID, CANCELLED|
|financial_transaction_type|PLATFORM_SALE, PROVIDER_FEE, REFUND, SETTLEMENT, EXPENSE, INTERNAL_SALE, INTERNAL_PURCHASE, RECEIPT, PAYMENT, ADJUSTMENT|
|financial_direction|INFLOW, OUTFLOW|
|employment_status|ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED|
|attendance_status|PRESENT, ABSENT, LATE, LEAVE, HOLIDAY, REMOTE|
|leave_status|PENDING, APPROVED, REJECTED, CANCELLED|
|payroll_status|DRAFT, CALCULATED, APPROVED, PAID, CANCELLED|
|payroll_item_status|DRAFT, APPROVED, PAID, HELD|
|work_project_status|PLANNED, ACTIVE, ON_HOLD, COMPLETED, CANCELLED|
|work_phase_status|NOT_STARTED, ACTIVE, COMPLETED, BLOCKED|
|task_priority|LOW, MEDIUM, HIGH, URGENT|
|task_status|BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED, CANCELLED|
|automation_status|DRAFT, ACTIVE, PAUSED, DISABLED|
|automation_run_status|RUNNING, SUCCEEDED, PARTIAL, FAILED, SKIPPED|
|marketing_channel|INTERNAL_DRAFT, FACEBOOK, INSTAGRAM, X, LINKEDIN, TIKTOK, OTHER|
|marketing_post_status|DRAFT, READY, SCHEDULED, PUBLISHING, PUBLISHED, FAILED, ARCHIVED|



#### **7.1 Provider Status Mapping Rule** 

- Store the original provider status in raw_payload or external_status. 

- Map known provider values to the normalized enum for common ERP dashboards and filters. 

- Use UNKNOWN rather than silently converting an unfamiliar provider value to a valid business status. 

- Alert integration operations when a new unknown status appears repeatedly. 

Confidential | Prepared for Business Flow | Page 23 

SaaS ERP Database Architecture and API Capability Specification 

### **8. Cross-cutting Constraints and Index Strategy** 

|**Area**|**Recommendation**|
|---|---|
|Tenant-scoped unique keys|All business-number uniqueness is scoped by company_id, for example UQ(company_id, invoice_number).|
|Provider identity|Everyexternal mirror has UQ(connected_project_id, external_id). Never make external_idgloballyunique.|
|Fast dashboards|Composite indexes begin with company_id or connected_project_id, followed by status/date used by filters.|
|Time-series lists|Use DESC indexes onplaced_at, occurred_at, created_at andperiod_end for recent-first screens.|
|Partial unique indexes|Use for one active subscription per company, one default CRM pipeline and one active full sync per entity.|
|Foreign keys|Use RESTRICT for financial/audit history; CASCADE onlyfor dependent draft/configuration rows where deletion is safe.|
|Check constraints|Money, quantities, percentages and date ranges must be validated in the database, not only the UI.|
|Idempotency|Provider writes requireproject-scoped idempotencykeys; webhook events requireprovider event ID orpayload hash.|
|Concurrency|Use row locks or atomic update statements for invoice sequences, stock balances and operation request transitions.|
|Search|Use PostgreSQL trigram/full-text indexes later for large contact/product search; avoidpremature indexes in V1.|
|High-volume retention|Webhook, integration error and audit data should use retention policies; monthly partitions are a scale step, not a V1 requirement.|
|RLS defense in depth|Optional PostgreSQL RLSpolicychecks company_id against the authenticated tenant context.|



#### **8.1 Delete Behavior** 

|**Record class**|**Recommended behavior**|
|---|---|
|Tenant master data|Soft delete where restoration is meaningful: branches, contacts, items and users.|
|Synchronizedprovider master data|Mark ARCHIVED/INACTIVE when absent fromprovider; do not immediatelydelete records referenced byhistorical orders.|
|Financial, settlement and order history|RESTRICT hard deletion; use reversal/cancellation records.|
|Webhook, audit and integration logs|Append-onlyuntil retention expiry.|
|Credentials|Revoke and replace; keep only minimal rotation metadata, not old plaintext.|



Confidential | Prepared for Business Flow | Page 24 

SaaS ERP Database Architecture and API Capability Specification 

### **9. Deliberate Simplifications and Exclusions** 

|**Simplification**|**Decision**|
|---|---|
|Full accounting removed|No chart of accounts, journals, journal lines, general ledger, trial balance, balance sheet or cash-flow statement in V1. This follows the user-approved simplified accounting decision.|
|No cross-platformproduct mapping|external_products belongto exactlyone connectedproject. “Burger” onplatform X is shown asplatform X’sproduct, even if anotherplatform has an item with the same name.|
|No assumed driver management|The schema can store drivers and operation requests, but driver create/update actions remain capability-gated.|
|No consumer installment schedule|Store merchant transaction, status, fee, refund, dispute and settlement information only. Do not store the customer’s full repayment calendar unless a verified API and explicit business need<br>exist.|
|Simple plans|Feature code, enabled flag and optional numeric limit only.|
|Simple branches/departments|No deeporganizational model,geofencingor branch-specific tax ledgers in V1.|
|Simple CRM|Calls, meetings, follow-ups and sales tasks share crm_activities instead of separate tables.|
|Simplepurchasing|Purchase request andpurchase order stages sharepurchase_orders.status.|
|Simple HR|Allowances, bonuses, deductions and advances are summarized in payroll_items instead of separate policy engines.|
|No report tables|BI dashboards are built fromqueries/materialized views when needed; static report tables would duplicate source data.|
|No AI content retention by default|ai_usage_logs records usage and cost, not full prompts/responses unless a specific audited feature requires them.|



#### **9.1 Recommended Implementation Order** 

1. Tenancy, fixed RBAC, plans/subscriptions and audit logging. 

2. Provider catalog, capabilities, connected projects, encrypted credentials and integration jobs. 

3. Webhook/idempotency foundation and provider adapters. 

4. External products, orders, locations, settlements and installment transactions. 

5. Simplified finance and executive dashboards. 

6. CRM, sales, purchasing and internal inventory. 

7. HR, internal work projects, automation, marketing and AI usage. 

Confidential | Prepared for Business Flow | Page 25 

SaaS ERP Database Architecture and API Capability Specification 

### **10. Official Sources and Research Notes** 

###### **Research limitation** 

API documentation can change and private partner scopes may differ by merchant. Revalidate the provider capability matrix during each provider onboarding and store the evidence URL and verified_at date in provider_capabilities. 

|**ID**|**Official source**|**URL**|**Use in this document**|
|---|---|---|---|
|S0|Uploaded SaaS ERP contract||Contract scope used for modules, multi-tenancy, subscriptions, branches, users, security, integrations and<br>reporting.|
|S1|HungerStation Partner API v2.0.2|https://developer.hungerstation.com/api-specifications|Public API reference.|
|S2|The Chefz restaurant partner application|https://thechefz.co/ar/apply-restaurant/|Official onboarding evidence; no public API reference verified.|
|S3|ToYou merchant partnership|https://toyou.io/|Official merchant partnership evidence; no public API reference verified.|
|S4|Mrsool Partnership|https://mrsool.co/partnership/|Official direct-integration statement and menu/product/photo scope.|
|S5|Ninja Restaurant Portal|https://restaurant-portal.ananinja.com/|Official merchant portal; public API reference not verified.|
|S6|Jahez Integration Portal|https://integration-portal.jahez.net/|Official integration portal; documentation is account-gated.|
|S7|Keeta Developer Documentation|https://api-docs.mykeeta.com/apis/standard/docs/intro|Public overview of Basic, Order, Store, Menu APIs, OAuth and onboarding.|
|S8|Shgardi Partner app listing|https://play.google.com/store/apps/details?id=com.shgardi.partner|Official partner-app functions; not server API documentation.|
|S9|Tabby API Reference|https://docs.tabby.ai/api-reference/overview|Public checkout, payment, webhook and dispute APIs.|
|S10|Tamara API Explorer|https://docs.tamara.co/reference/tamara-api-reference-documentation|Public checkout/order/refund/webhook/dispute APIs.|
|S11|Madfu official site|https://madfu.com.sa/en/home|Official service evidence; no public developer API reference verified.|
|S12|MIS Pay Developer Integration|https://www.mispay.dev/integration|Official integration material and REST checkout guide.|
|S13|Emkan Merchant Portal|https://merchants.emkanfinance.com.sa/|Official Developer Tools portal; detailed endpoints account-gated.|
|S14|Zid Partner Documentation|https://docs.zid.sa/start-here|Public merchant API capabilities.|
|S15|Salla Partner Documentation|https://docs.salla.dev/|Public Merchant REST/OAuth, fulfillment, events and checkout documentation.|
|S16|WooCommerce REST API v3|https://developer.woocommerce.com/docs/apis/rest-api/v3/|Current recommended WooCommerce REST API.|
|S17|Shopify GraphQL Admin API|https://shopify.dev/docs/api/admin-graphql/latest|Versioned Admin API and resource catalog.|



#### **10.1 Final Validation Checklist Before Development** 

- Obtain official provider documentation and credentials for every PARTNER_PORTAL, PRIVATE_CONFIRMED or UNVERIFIED_PUBLICLY provider. 

- Record granted scopes per connected project and compare them to the provider capability matrix. 

- Confirm webhook signature method, rate limits, pagination, retry policy and sandbox availability for each provider. 

- Confirm provider data-retention and PII obligations before importing customers or drivers. 

- Create adapter contract tests for idempotency, unknown statuses and partial failures. 

- Do not enable a UI write action merely because the generic database table exists. 

Confidential | Prepared for Business Flow | Page 26 

