package com.example.demo.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "clients")
public class Client {

    @Id
    private String id;
    private String name;
    private String phone;
    private String type;
    private String policy;
    private String notes;

    public Client() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    
    public String getPolicy() { return policy; }
    public void setPolicy(String policy) { this.policy = policy; }
    
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
