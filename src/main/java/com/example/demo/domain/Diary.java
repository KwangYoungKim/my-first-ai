package com.example.demo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "diaries")
public class Diary {

    @Id
    private String date; // "YYYY-MM-DD"
    
    @Column(columnDefinition = "TEXT")
    private String content;

    public Diary() {}

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }
    
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
