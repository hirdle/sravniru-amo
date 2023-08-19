async function create_lead (referer, token, name, phone, email) {
    const contact = [{
    "first_name": name,
    "custom_fields_values": [
        {
            "field_id": 45887,
            "values": [
                {
                    "value": phone
                }
            ]
        },

        {
            "field_id": 45889,
            "values": [
                {
                    "value": email
                }
            ]
        }

    
        ]
    }]

    const res_contact = await fetch(`https://${referer}/api/v4/contacts`, {
        method: 'POST',
        body: JSON.stringify(contact),
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
    
    const contact_json = await res_contact.json()
    const contact_id = contact_json._embedded.contacts[0].id


    const lead = [{
        "name": `Заявка от сравни.ру пользователя ${name}`,
        "_embedded": {
            "contacts": [
                {
                    "id": contact_id
                }
            ]
        }
    }]

    const res_lead = await fetch(`https://${referer}/api/v4/leads`, {
        method: 'POST',
        body: JSON.stringify(lead),
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    })
    
    const lead_json = await res_lead.json()
    const lead_id = lead_json._embedded.contacts[0].id
    

    res.json({"status": "ok", "data": lead_json})
    
    // fetch('https://ovalbom.amocrm.ru/api/v4/contacts/custom_fields', {
    //     method: 'GET',
    //     // body: JSON.stringify(contact),
    //     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${amocrm_token}` }
    // })
    // .then(r => r.json())
    // .then(r => res.json(r))
}