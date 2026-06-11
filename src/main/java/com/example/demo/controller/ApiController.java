package com.example.demo.controller;

import com.example.demo.domain.*;
import com.example.demo.repository.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ApiController {

    private final ClientRepository clientRepository;
    private final EventRepository eventRepository;
    private final TaskRepository taskRepository;
    private final DiaryRepository diaryRepository;

    public ApiController(ClientRepository clientRepository, EventRepository eventRepository,
                         TaskRepository taskRepository, DiaryRepository diaryRepository) {
        this.clientRepository = clientRepository;
        this.eventRepository = eventRepository;
        this.taskRepository = taskRepository;
        this.diaryRepository = diaryRepository;
    }

    // Clients
    @GetMapping("/clients")
    public List<Client> getClients() {
        return clientRepository.findAll();
    }

    @PostMapping("/clients")
    public Client addClient(@RequestBody Client client) {
        return clientRepository.save(client);
    }

    @DeleteMapping("/clients/{id}")
    public void deleteClient(@PathVariable String id) {
        clientRepository.deleteById(id);
    }

    // Events
    @GetMapping("/events")
    public List<Event> getEvents() {
        return eventRepository.findAll();
    }

    @PostMapping("/events")
    public Event addEvent(@RequestBody Event event) {
        return eventRepository.save(event);
    }

    @DeleteMapping("/events/{id}")
    public void deleteEvent(@PathVariable String id) {
        eventRepository.deleteById(id);
    }

    // Tasks
    @GetMapping("/tasks")
    public List<Task> getTasks() {
        return taskRepository.findAll();
    }

    @PostMapping("/tasks")
    public Task addTask(@RequestBody Task task) {
        return taskRepository.save(task);
    }

    @PutMapping("/tasks/{id}")
    public Task updateTask(@PathVariable String id, @RequestBody Task task) {
        task.setId(id);
        return taskRepository.save(task);
    }

    @DeleteMapping("/tasks/{id}")
    public void deleteTask(@PathVariable String id) {
        taskRepository.deleteById(id);
    }

    // Diaries
    @GetMapping("/diaries")
    public List<Diary> getDiaries() {
        return diaryRepository.findAll();
    }

    @PostMapping("/diaries")
    public Diary saveDiary(@RequestBody Diary diary) {
        return diaryRepository.save(diary);
    }
}
