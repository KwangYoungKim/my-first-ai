package com.example.demo.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "events")
public class Event {

    @Id
    private String id;
    private String date; // "YYYY-MM-DD"
    private String time; // "HH:mm"
    private String title;
    private String type;
    private String clientId; // can be empty or null

    public Event() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }
    
    public String getTime() { return time; }
    public void setTime(String time) { this.time = time; }
    
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    
    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }
}
